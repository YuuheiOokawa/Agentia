import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyTool } from "@agentia/shared-types";
import type { InternalEvent } from "@agentia/shared-types";

export interface SessionSummary {
  sessionId: string;
  projectId: string;
  startedAt: string;
  endedAt: string | null;
  eventCount: number;
  editCount: number;
  readCount: number;
  bashCount: number;
  testCount: number;
  testSuccessCount: number;
  testFailureCount: number;
  subAgentCount: number;
}

const READ_TOOLS = new Set(["Read", "Grep", "Glob"]);
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

function isTestCommand(target: string | null): boolean {
  if (!target) return false;
  return classifyTool("Bash", { command: target }).state === "testing";
}

/** Reads one session's JSONL log and reduces it into a summary (docs/11_DATABASE_DESIGN.md #1: no DB yet). */
function summarize(sessionId: string, events: InternalEvent[]): SessionSummary | null {
  if (events.length === 0) return null;
  const summary: SessionSummary = {
    sessionId,
    projectId: events[0]!.projectId,
    startedAt: events[0]!.timestamp,
    endedAt: null,
    eventCount: events.length,
    editCount: 0,
    readCount: 0,
    bashCount: 0,
    testCount: 0,
    testSuccessCount: 0,
    testFailureCount: 0,
    subAgentCount: 0,
  };

  for (const event of events) {
    if (event.eventType === "session_end") summary.endedAt = event.timestamp;
    if (event.eventType === "agent_spawn") summary.subAgentCount += 1;

    if (event.eventType === "tool_result" || event.eventType === "tool_error") {
      const toolName = event.toolName ?? "";
      if (EDIT_TOOLS.has(toolName)) summary.editCount += 1;
      else if (READ_TOOLS.has(toolName)) summary.readCount += 1;
      else if (toolName === "Bash") {
        summary.bashCount += 1;
        if (isTestCommand(event.target)) {
          summary.testCount += 1;
          if (event.eventType === "tool_result") summary.testSuccessCount += 1;
          else summary.testFailureCount += 1;
        }
      }
    }
  }
  return summary;
}

function parseJsonl(filePath: string): InternalEvent[] {
  const raw = readFileSync(filePath, "utf8");
  const events: InternalEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as InternalEvent);
    } catch {
      // Skip a corrupted line rather than failing the whole scan.
    }
  }
  return events;
}

/** Scans every `${sessionId}.jsonl` file under logDir and summarizes it. */
export function scanAllSessions(logDir: string): SessionSummary[] {
  let files: string[];
  try {
    files = readdirSync(logDir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return [];
  }

  const summaries: SessionSummary[] = [];
  for (const file of files) {
    const sessionId = file.slice(0, -".jsonl".length);
    const events = parseJsonl(join(logDir, file));
    const summary = summarize(sessionId, events);
    if (summary) summaries.push(summary);
  }
  return summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function scanSession(logDir: string, sessionId: string): { summary: SessionSummary; events: InternalEvent[] } | null {
  try {
    const events = parseJsonl(join(logDir, `${sessionId}.jsonl`));
    const summary = summarize(sessionId, events);
    return summary ? { summary, events } : null;
  } catch {
    return null;
  }
}
