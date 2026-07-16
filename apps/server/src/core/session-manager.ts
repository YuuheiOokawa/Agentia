import { EventEmitter } from "node:events";
import type { Employee, IngestRequest, InternalEvent } from "@agentia/shared-types";
import { SessionCorrelator } from "./correlator.js";
import { DedupeCache } from "./dedupe-cache.js";
import { applyEventToEmployee } from "./employee-tracker.js";
import { buildAgentSpawnEvent, buildAgentStopEvent, buildOfflineEvent, normalize } from "./normalizer.js";
import { SessionRingBuffer } from "../persistence/ring-buffer.js";
import { JsonlWriter } from "../persistence/jsonl-writer.js";
import type { ProjectRegistry } from "../persistence/project-registry.js";
import { markSessionEnded, persistAgentCompleted, persistAgentSpawned, persistEvent, upsertSession } from "../persistence/db-writer.js";

interface SessionRuntime {
  sessionId: string;
  projectId: string;
  correlator: SessionCorrelator;
  seq: number;
  lastEventAtMs: number;
  offlineNotified: boolean;
  employees: Map<string, Employee>;
  /** Resolves once the Postgres Session row exists; Event/Agent writes chain off this (FK ordering). */
  dbReady: Promise<void>;
}

export interface SessionManagerOptions {
  logDir: string;
  ringBufferMaxEvents: number;
  dedupeCacheMaxEntries: number;
  inactiveAgentTimeoutMs: number;
  offlineDetectionTimeoutMs: number;
  clock?: () => number;
}

/**
 * Orchestrates docs/03_SYSTEM_ARCHITECTURE.md's Ingest -> Normalizer -> Correlator -> Buffer pipeline.
 * Emits "event" (projectId, sessionId, InternalEvent) for the WebSocket hub to broadcast (docs/14 #2).
 */
export class SessionManager extends EventEmitter {
  private readonly sessions = new Map<string, SessionRuntime>();
  private readonly dedupeCache: DedupeCache;
  private readonly ringBuffer: SessionRingBuffer;
  private readonly jsonlWriter: JsonlWriter;
  private readonly clock: () => number;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly options: SessionManagerOptions,
    private readonly projectRegistry: ProjectRegistry
  ) {
    super();
    this.dedupeCache = new DedupeCache(options.dedupeCacheMaxEntries);
    this.ringBuffer = new SessionRingBuffer(options.ringBufferMaxEvents);
    this.jsonlWriter = new JsonlWriter(options.logDir);
    this.clock = options.clock ?? (() => Date.now());
  }

  start(): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweep(), 5_000);
  }

  stop(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  getRingBuffer(): SessionRingBuffer {
    return this.ringBuffer;
  }

  private resolveProjectId(cwd: string): string {
    return this.projectRegistry.resolveByRoot(cwd).projectId;
  }

  private getOrCreateSession(sessionId: string, projectId: string): SessionRuntime {
    let runtime = this.sessions.get(sessionId);
    if (!runtime) {
      const startedAt = new Date(this.clock());
      runtime = {
        sessionId,
        projectId,
        correlator: new SessionCorrelator(this.clock),
        seq: 0,
        lastEventAtMs: this.clock(),
        offlineNotified: false,
        employees: new Map(),
        dbReady: upsertSession(sessionId, projectId, startedAt),
      };
      this.sessions.set(sessionId, runtime);
    }
    return runtime;
  }

  private publish(runtime: SessionRuntime, event: InternalEvent, rawToolInput: Record<string, unknown> | null = null): void {
    runtime.seq += 1;
    const finalEvent: InternalEvent = { ...event, seq: runtime.seq };
    this.ringBuffer.push(runtime.sessionId, finalEvent);
    void this.jsonlWriter.append(runtime.sessionId, finalEvent);
    void runtime.dbReady.then(() => persistEvent(finalEvent));
    if (finalEvent.eventType === "session_end") {
      void runtime.dbReady.then(() => markSessionEnded(runtime.sessionId, new Date(finalEvent.timestamp)));
    }
    if (finalEvent.eventType === "agent_spawn") {
      void runtime.dbReady.then(() =>
        persistAgentSpawned({
          sessionId: runtime.sessionId,
          internalId: finalEvent.agentId,
          parentAgentId: finalEvent.parentAgentId,
          agentType: finalEvent.agentType,
          displayName: finalEvent.displayName,
          spawnedAt: new Date(finalEvent.timestamp),
        })
      );
    }
    if (finalEvent.eventType === "agent_stop") {
      void runtime.dbReady.then(() => persistAgentCompleted(runtime.sessionId, finalEvent.agentId, new Date(finalEvent.timestamp)));
    }

    const current = runtime.employees.get(finalEvent.agentId) ?? null;
    const updated = applyEventToEmployee(current, finalEvent, rawToolInput);
    if (updated) runtime.employees.set(finalEvent.agentId, updated);
    else runtime.employees.delete(finalEvent.agentId);

    this.emit("event", runtime.projectId, runtime.sessionId, finalEvent);
  }

  /** Current employees for a session, used to build SNAPSHOT on (re)connect (docs/06 #2.1). */
  listEmployees(sessionId: string): Employee[] {
    return Array.from(this.sessions.get(sessionId)?.employees.values() ?? []);
  }

  /** Most recently active session for a project, used to pick which session a new WS client observes. */
  getActiveSessionId(projectId: string): string | undefined {
    let latest: SessionRuntime | undefined;
    for (const runtime of this.sessions.values()) {
      if (runtime.projectId !== projectId) continue;
      if (!latest || runtime.lastEventAtMs > latest.lastEventAtMs) latest = runtime;
    }
    return latest?.sessionId;
  }

  /** Entry point for POST /internal/events (docs/12_API_DESIGN.md #2). Returns false if dropped as a duplicate. */
  ingest(request: IngestRequest): boolean {
    if (this.dedupeCache.checkAndRecord(request.clientEventId)) return false;

    const payload = request.payload;
    const projectId = this.resolveProjectId(payload.cwd);
    const runtime = this.getOrCreateSession(payload.session_id, projectId);
    runtime.lastEventAtMs = this.clock();
    runtime.offlineNotified = false;

    const resolvedAgent = runtime.correlator.resolve(payload);
    if (resolvedAgent.isNewAgent && resolvedAgent.agentId !== "agent_main") {
      this.publish(runtime, buildAgentSpawnEvent(projectId, runtime.sessionId, resolvedAgent));
    }

    const event = normalize({ hookEventName: request.hookEventName, payload, projectId, resolvedAgent });
    if (event) {
      const toolInput = (payload.tool_input as Record<string, unknown> | undefined) ?? null;
      this.publish(runtime, event, toolInput);
    }

    if (request.hookEventName === "SubagentStop" && resolvedAgent.agentId !== "agent_main") {
      runtime.correlator.markStopped(resolvedAgent.agentId);
    }
    return true;
  }

  private sweep(): void {
    const nowMs = this.clock();
    for (const runtime of this.sessions.values()) {
      const stopped = runtime.correlator.sweepInactive(this.options.inactiveAgentTimeoutMs);
      for (const agent of stopped) {
        this.publish(runtime, buildAgentStopEvent(runtime.projectId, runtime.sessionId, agent));
      }
      if (!runtime.offlineNotified && nowMs - runtime.lastEventAtMs > this.options.offlineDetectionTimeoutMs) {
        runtime.offlineNotified = true;
        this.publish(runtime, buildOfflineEvent(runtime.projectId, runtime.sessionId));
      }
    }
  }
}
