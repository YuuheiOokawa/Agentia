import { describe, expect, it } from "vitest";
import type { RawHookPayload } from "@agentia/shared-types";
import { normalize } from "./normalizer.js";

const mainAgent = {
  agentId: "agent_main",
  agentType: "main" as const,
  parentAgentId: null,
  displayName: "Claude (Main)",
  isNewAgent: false,
};

function payload(overrides: Partial<RawHookPayload> = {}): RawHookPayload {
  return { session_id: "session_1", cwd: "/repo", hook_event_name: "PreToolUse", ...overrides };
}

describe("normalize", () => {
  it("maps PreToolUse -> tool_use with status running", () => {
    const event = normalize({
      hookEventName: "PreToolUse",
      payload: payload({ tool_name: "Edit", tool_input: { file_path: "src/a.ts" } }),
      projectId: "proj_x",
      resolvedAgent: mainAgent,
    });
    expect(event?.eventType).toBe("tool_use");
    expect(event?.status).toBe("running");
    expect(event?.target).toBe("src/a.ts");
    expect(event?.message).toContain("src/a.ts");
  });

  it("maps PostToolUseFailure -> tool_error with status error", () => {
    const event = normalize({
      hookEventName: "PostToolUseFailure",
      payload: payload({ hook_event_name: "PostToolUseFailure", tool_name: "Bash" }),
      projectId: "proj_x",
      resolvedAgent: mainAgent,
    });
    expect(event?.eventType).toBe("tool_error");
    expect(event?.status).toBe("error");
  });

  it("drops Notification events outside the waiting-input allow-list", () => {
    const event = normalize({
      hookEventName: "Notification",
      payload: payload({ hook_event_name: "Notification", notification_type: "auth_success" }),
      projectId: "proj_x",
      resolvedAgent: mainAgent,
    });
    expect(event).toBeNull();
  });

  it("keeps Notification events that represent a real waiting-for-input state", () => {
    const event = normalize({
      hookEventName: "Notification",
      payload: payload({ hook_event_name: "Notification", notification_type: "permission_prompt" }),
      projectId: "proj_x",
      resolvedAgent: mainAgent,
    });
    expect(event?.eventType).toBe("waiting_input");
    expect(event?.status).toBe("waiting");
  });

  it("returns null for hook events outside MVP scope", () => {
    const event = normalize({
      hookEventName: "FileChanged",
      payload: payload({ hook_event_name: "FileChanged" }),
      projectId: "proj_x",
      resolvedAgent: mainAgent,
    });
    expect(event).toBeNull();
  });
});
