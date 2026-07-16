import { describe, expect, it } from "vitest";
import type { RawHookPayload } from "@agentia/shared-types";
import { SessionCorrelator } from "./correlator.js";

function payload(overrides: Partial<RawHookPayload> = {}): RawHookPayload {
  return {
    session_id: "session_1",
    cwd: "/repo",
    hook_event_name: "PreToolUse",
    ...overrides,
  };
}

describe("SessionCorrelator", () => {
  it("resolves the main agent when agent_id is absent", () => {
    const correlator = new SessionCorrelator();
    const resolved = correlator.resolve(payload({ tool_name: "Read" }));
    expect(resolved.agentId).toBe("agent_main");
    expect(resolved.agentType).toBe("main");
    expect(resolved.parentAgentId).toBeNull();
    expect(resolved.isNewAgent).toBe(true);
  });

  it("marks a new sub agent as new only once", () => {
    const correlator = new SessionCorrelator();
    const first = correlator.resolve(payload({ agent_id: "sub-1", agent_type: "Explore", tool_name: "Read" }));
    const second = correlator.resolve(payload({ agent_id: "sub-1", tool_name: "Grep" }));
    expect(first.isNewAgent).toBe(true);
    expect(second.isNewAgent).toBe(false);
    expect(first.agentId).toBe(second.agentId);
    expect(first.parentAgentId).toBe("agent_main");
  });

  it("infers implementation role once Edit/Write dominate recent tool calls", () => {
    const correlator = new SessionCorrelator();
    correlator.resolve(payload({ agent_id: "sub-2", agent_type: "general-purpose", tool_name: "Edit" }));
    correlator.resolve(payload({ agent_id: "sub-2", tool_name: "Write" }));
    const resolved = correlator.resolve(payload({ agent_id: "sub-2", tool_name: "Edit" }));
    expect(resolved.agentType).toBe("implementation");
  });

  it("sweeps sub agents inactive beyond the timeout, but never the main agent", () => {
    let now = 0;
    const correlator = new SessionCorrelator(() => now);
    correlator.resolve(payload({ tool_name: "Read" })); // main
    correlator.resolve(payload({ agent_id: "sub-3", tool_name: "Read" }));

    now += 100_000;
    const stopped = correlator.sweepInactive(90_000);
    expect(stopped).toHaveLength(1);
    expect(stopped[0]?.agentId).toBe("agent_sub-3");
  });
});
