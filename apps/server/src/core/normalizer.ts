import { randomUUID } from "node:crypto";
import { classifyTool, extractToolTarget } from "@agentia/shared-types";
import type { EmployeeRole, EventType, InternalEvent, RawHookPayload } from "@agentia/shared-types";
import { buildMessage } from "./message-templates.js";
import type { ResolvedAgent } from "./correlator.js";

/**
 * docs/05_EVENT_DESIGN.md #2: hook_event_name -> internal eventType. Anything absent here is out of MVP scope.
 * Note: SubagentStart is intentionally NOT mapped here - SessionManager.ingest() already synthesizes exactly
 * one agent_spawn event the moment the correlator sees a never-before-seen agent_id (docs/05 #4), which is
 * precisely what SubagentStart signals. Mapping it here too would emit a duplicate agent_spawn per sub agent.
 */
const HOOK_EVENT_TYPE_MAP: Record<string, EventType> = {
  SessionStart: "session_start",
  SessionEnd: "session_end",
  UserPromptSubmit: "user_prompt_submit",
  PreToolUse: "tool_use",
  PostToolUse: "tool_result",
  PostToolUseFailure: "tool_error",
  SubagentStop: "agent_stop",
  Notification: "waiting_input",
  Stop: "turn_complete",
  PreCompact: "context_compact",
  PostCompact: "context_compact",
};

/** docs/04_CLAUDE_CODE_INTEGRATION.md #2.1: only these Notification matchers represent a user-input-needed state. */
const WAITING_NOTIFICATION_TYPES = new Set(["permission_prompt", "idle_prompt", "agent_needs_input"]);

export interface NormalizeParams {
  hookEventName: string;
  payload: RawHookPayload;
  projectId: string;
  resolvedAgent: ResolvedAgent;
}

function statusFor(eventType: EventType): InternalEvent["status"] {
  switch (eventType) {
    case "tool_use":
      return "running";
    case "tool_result":
      return "success";
    case "tool_error":
      return "error";
    case "waiting_input":
      return "waiting";
    default:
      return "info";
  }
}

function baseEvent(
  projectId: string,
  sessionId: string,
  agent: ResolvedAgent,
  eventType: EventType
): Omit<InternalEvent, "toolName" | "status" | "target" | "message"> {
  return {
    eventSchemaVersion: "1.0",
    eventId: randomUUID(),
    eventSource: "claude_code",
    projectId,
    sessionId,
    agentId: agent.agentId,
    agentType: agent.agentType,
    parentAgentId: agent.parentAgentId,
    displayName: agent.displayName,
    eventType,
    timestamp: new Date().toISOString(),
    seq: 0, // assigned by the WebSocket hub (docs/06_REALTIME_COMMUNICATION.md #2) just before broadcast
  };
}

/**
 * Converts one raw Claude Code hook payload into an internal event.
 * Returns null when the hook fires but carries no MVP-relevant signal
 * (e.g. a Notification matcher outside docs/04 #2.1's allow-list).
 */
export function normalize(params: NormalizeParams): InternalEvent | null {
  const { hookEventName, payload, projectId, resolvedAgent } = params;
  const eventType = HOOK_EVENT_TYPE_MAP[hookEventName];
  if (!eventType) return null;

  if (eventType === "waiting_input") {
    const notificationType = payload.notification_type;
    if (!notificationType || !WAITING_NOTIFICATION_TYPES.has(notificationType)) return null;
  }

  const toolName = payload.tool_name ?? null;
  const toolInput = (payload.tool_input as Record<string, unknown> | undefined) ?? null;
  const target = toolName ? extractToolTarget(toolName, toolInput) : null;

  return {
    ...baseEvent(projectId, payload.session_id, resolvedAgent, eventType),
    toolName,
    status: statusFor(eventType),
    target,
    message: buildMessage(eventType, { toolName, target, displayName: resolvedAgent.displayName }),
  };
}

/** The (state, areaId) a client should apply when it receives this event; kept alongside the event, not inside it. */
export function classifyEvent(event: InternalEvent, rawToolInput: Record<string, unknown> | null) {
  if (event.eventType !== "tool_use" || !event.toolName) return null;
  return classifyTool(event.toolName, rawToolInput);
}

export function buildAgentSpawnEvent(projectId: string, sessionId: string, agent: ResolvedAgent): InternalEvent {
  return {
    ...baseEvent(projectId, sessionId, agent, "agent_spawn"),
    toolName: null,
    status: "info",
    target: null,
    message: buildMessage("agent_spawn", { displayName: agent.displayName }),
  };
}

export function buildAgentStopEvent(projectId: string, sessionId: string, agent: ResolvedAgent): InternalEvent {
  return {
    ...baseEvent(projectId, sessionId, agent, "agent_stop"),
    toolName: null,
    status: "info",
    target: null,
    message: buildMessage("agent_stop", { displayName: agent.displayName }),
  };
}

export function buildOfflineEvent(projectId: string, sessionId: string): InternalEvent {
  const mainAgent: ResolvedAgent = {
    agentId: "agent_main",
    agentType: "main" as EmployeeRole,
    parentAgentId: null,
    displayName: "Claude (Main)",
    isNewAgent: false,
  };
  return {
    ...baseEvent(projectId, sessionId, mainAgent, "claude_code_offline"),
    toolName: null,
    status: "error",
    target: null,
    message: buildMessage("claude_code_offline", {}),
  };
}
