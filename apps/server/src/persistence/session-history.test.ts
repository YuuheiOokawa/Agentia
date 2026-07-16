import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { InternalEvent } from "@agentia/shared-types";
import { scanAllSessions, scanSession } from "./session-history.js";

function event(overrides: Partial<InternalEvent>): InternalEvent {
  return {
    eventSchemaVersion: "1.0",
    eventId: "e1",
    eventSource: "claude_code",
    projectId: "proj_x",
    sessionId: "session_1",
    agentId: "agent_main",
    agentType: "main",
    parentAgentId: null,
    displayName: "Claude (Main)",
    eventType: "tool_use",
    toolName: null,
    status: "running",
    target: null,
    message: "",
    timestamp: "2026-07-16T10:00:00.000Z",
    seq: 1,
    ...overrides,
  };
}

describe("session-history", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agentia-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("summarizes edit/read/bash/test counts and subAgentCount from a JSONL log", () => {
    const events: InternalEvent[] = [
      event({ eventType: "session_start", seq: 1, timestamp: "2026-07-16T10:00:00.000Z" }),
      event({ eventType: "tool_result", toolName: "Edit", status: "success", seq: 2 }),
      event({ eventType: "tool_result", toolName: "Read", status: "success", seq: 3 }),
      event({ eventType: "tool_result", toolName: "Bash", target: "npm test", status: "success", seq: 4 }),
      event({ eventType: "tool_error", toolName: "Bash", target: "npm test", status: "error", seq: 5 }),
      event({ agentId: "agent_sub1", eventType: "agent_spawn", seq: 6 }),
      event({ eventType: "session_end", seq: 7, timestamp: "2026-07-16T10:05:00.000Z" }),
    ];
    writeFileSync(join(dir, "session_1.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");

    const found = scanSession(dir, "session_1");
    expect(found?.summary.editCount).toBe(1);
    expect(found?.summary.readCount).toBe(1);
    expect(found?.summary.bashCount).toBe(2);
    expect(found?.summary.testCount).toBe(2);
    expect(found?.summary.testSuccessCount).toBe(1);
    expect(found?.summary.testFailureCount).toBe(1);
    expect(found?.summary.subAgentCount).toBe(1);
    expect(found?.summary.endedAt).toBe("2026-07-16T10:05:00.000Z");
  });

  it("scans every jsonl file in the log directory", () => {
    writeFileSync(join(dir, "session_a.jsonl"), JSON.stringify(event({ sessionId: "session_a" })) + "\n");
    writeFileSync(join(dir, "session_b.jsonl"), JSON.stringify(event({ sessionId: "session_b" })) + "\n");

    const summaries = scanAllSessions(dir);
    expect(summaries.map((s) => s.sessionId).sort()).toEqual(["session_a", "session_b"]);
  });

  it("returns an empty array when the log directory doesn't exist", () => {
    expect(scanAllSessions(join(dir, "missing"))).toEqual([]);
  });

  it("skips corrupted lines instead of throwing", () => {
    writeFileSync(join(dir, "session_c.jsonl"), `not json\n${JSON.stringify(event({ sessionId: "session_c" }))}\n`);
    const found = scanSession(dir, "session_c");
    expect(found?.summary.eventCount).toBe(1);
  });
});
