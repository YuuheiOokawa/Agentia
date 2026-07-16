import { describe, expect, it } from "vitest";
import type { InternalEvent } from "@agentia/shared-types";
import { applyEvent } from "./apply-event";

function baseEvent(overrides: Partial<InternalEvent>): InternalEvent {
  return {
    eventSchemaVersion: "1.0",
    eventId: "evt-1",
    eventSource: "claude_code",
    projectId: "proj_x",
    sessionId: "session_1",
    agentId: "agent_main",
    agentType: "main",
    parentAgentId: null,
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

describe("applyEvent", () => {
  it("creates a new employee on the first event and routes Edit to the dev floor", () => {
    const employees = applyEvent({}, baseEvent({ toolName: "Edit", target: "src/a.ts", message: "編集中" }));
    const main = employees["agent_main"];
    expect(main?.state).toBe("coding");
    expect(main?.areaId).toBe("dev_floor");
    expect(main?.currentTask).toBe("編集中");
  });

  it("routes Read to the library", () => {
    const employees = applyEvent({}, baseEvent({ toolName: "Read", target: "src/a.ts" }));
    expect(employees["agent_main"]?.state).toBe("reading");
    expect(employees["agent_main"]?.areaId).toBe("library");
  });

  it("sets hasWarning and error state on tool_error, and clears it on the next successful tool_use", () => {
    let employees = applyEvent({}, baseEvent({ toolName: "Bash", eventType: "tool_error", status: "error" }));
    expect(employees["agent_main"]?.state).toBe("error");
    expect(employees["agent_main"]?.hasWarning).toBe(true);

    employees = applyEvent(employees, baseEvent({ toolName: "Read", eventType: "tool_use", status: "running", seq: 2 }));
    expect(employees["agent_main"]?.hasWarning).toBe(false);
  });

  it("moves to break_room and marks completedAt on turn_complete", () => {
    const employees = applyEvent(
      {},
      baseEvent({ eventType: "turn_complete", status: "info", timestamp: "2026-07-16T10:05:00.000Z", seq: 2 })
    );
    expect(employees["agent_main"]?.areaId).toBe("break_room");
    expect(employees["agent_main"]?.state).toBe("completed");
    expect(employees["agent_main"]?.completedAt).toBe("2026-07-16T10:05:00.000Z");
  });

  it("removes the employee entirely on agent_stop", () => {
    let employees = applyEvent(
      {},
      baseEvent({ agentId: "agent_sub1", agentType: "explore", parentAgentId: "agent_main", eventType: "agent_spawn" })
    );
    expect(employees["agent_sub1"]).toBeDefined();
    employees = applyEvent(employees, baseEvent({ agentId: "agent_sub1", eventType: "agent_stop", seq: 2 }));
    expect(employees["agent_sub1"]).toBeUndefined();
  });

  it("queues a lower-priority destination change instead of yanking the character mid-task", () => {
    let employees = applyEvent({}, baseEvent({ toolName: "Read", eventType: "tool_use" }));
    employees = applyEvent(employees, baseEvent({ toolName: "Edit", eventType: "tool_use", seq: 2 }));
    // still reading in the library; Edit got queued rather than interrupting
    expect(employees["agent_main"]?.areaId).toBe("library");
    expect(employees["agent_main"]?.movementQueue).toHaveLength(1);
  });
});
