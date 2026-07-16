import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SessionManager } from "../core/session-manager.js";
import type { ProjectRegistry } from "../persistence/project-registry.js";
import { env } from "../config/env.js";

const HOOK_COMMAND = "agentia-hook";

/** docs/04_CLAUDE_CODE_INTEGRATION.md #2: the hook events + matchers Agentia wires up. */
const HOOK_EVENTS: Array<{ event: string; matcher?: string; timeout: number }> = [
  { event: "SessionStart", timeout: 10 },
  { event: "SessionEnd", timeout: 10 },
  { event: "UserPromptSubmit", timeout: 5 },
  { event: "PreToolUse", matcher: "*", timeout: 5 },
  { event: "PostToolUse", matcher: "*", timeout: 5 },
  { event: "PostToolUseFailure", matcher: "*", timeout: 5 },
  { event: "SubagentStart", matcher: "*", timeout: 5 },
  { event: "SubagentStop", matcher: "*", timeout: 5 },
  { event: "Notification", timeout: 5 },
  { event: "Stop", timeout: 5 },
  { event: "PreCompact", timeout: 5 },
];

interface HookEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string; timeout: number }>;
}

interface ClaudeSettings {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

function hasAgentiaHook(entries: HookEntry[] | undefined): boolean {
  return (entries ?? []).some((entry) => entry.hooks.some((h) => h.command === HOOK_COMMAND));
}

/** Idempotently merges Agentia's hook config into an existing .claude/settings.json without clobbering other hooks. */
function mergeSettings(existing: ClaudeSettings): { settings: ClaudeSettings; changed: boolean } {
  const hooks: Record<string, HookEntry[]> = { ...(existing.hooks ?? {}) };
  let changed = false;

  for (const { event, matcher, timeout } of HOOK_EVENTS) {
    const entries = hooks[event] ?? [];
    if (hasAgentiaHook(entries)) continue;
    const newEntry: HookEntry = {
      ...(matcher !== undefined ? { matcher } : {}),
      hooks: [{ type: "command", command: HOOK_COMMAND, timeout }],
    };
    hooks[event] = [...entries, newEntry];
    changed = true;
  }

  return { settings: { ...existing, hooks }, changed };
}

function hooksConfigured(settings: ClaudeSettings): boolean {
  return HOOK_EVENTS.every(({ event }) => hasAgentiaHook(settings.hooks?.[event]));
}

const SetupBodySchema = z.object({ projectRoot: z.string() });
const StatusQuerySchema = z.object({ projectRoot: z.string().optional() });

export function registerConnectionRoutes(
  fastify: FastifyInstance,
  sessionManager: SessionManager,
  projectRegistry: ProjectRegistry
): void {
  fastify.get("/api/connection/status", async (request, reply) => {
    const query = StatusQuerySchema.safeParse(request.query);
    const projectRoot = query.success ? query.data.projectRoot : undefined;

    let hooksStatus: "configured" | "missing" | "unknown" = "unknown";
    if (projectRoot) {
      try {
        const raw = await readFile(join(projectRoot, ".claude", "settings.json"), "utf8");
        hooksStatus = hooksConfigured(JSON.parse(raw) as ClaudeSettings) ? "configured" : "missing";
      } catch {
        hooksStatus = "missing";
      }
    }

    return reply.send({
      ingestServer: "running",
      port: env.port,
      hooksStatus,
    });
  });

  fastify.post("/api/connection/setup", async (request, reply) => {
    const parsed = SetupBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "INVALID_BODY", message: "projectRoot is required", details: null } });
    }
    const settingsPath = join(parsed.data.projectRoot, ".claude", "settings.json");

    let existing: ClaudeSettings = {};
    try {
      existing = JSON.parse(await readFile(settingsPath, "utf8")) as ClaudeSettings;
    } catch {
      // No existing settings.json (or unreadable) - start from an empty config.
    }

    const { settings, changed } = mergeSettings(existing);
    if (changed) {
      await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    }
    const project = projectRegistry.ensureRegistered(parsed.data.projectRoot);
    return reply.send({ changed, settingsPath, projectId: project.projectId });
  });

  fastify.post("/api/connection/test", async (_request, reply) => {
    sessionManager.ingest({
      clientEventId: randomUUID(),
      hookEventName: "Notification",
      payload: {
        session_id: "session_connection_test",
        cwd: process.cwd(),
        hook_event_name: "Notification",
        notification_type: "agent_needs_input",
        message: "接続テスト",
      },
    });
    return reply.send({ ok: true, message: "テストイベントを送信しました" });
  });
}
