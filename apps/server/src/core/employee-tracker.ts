import { classifyTool } from "@agentia/shared-types";
import type { AreaId, CharacterState, Employee, InternalEvent } from "@agentia/shared-types";

/** docs/09_CHARACTER_SYSTEM.md #3: idle characters rest at their own desk, not the active work floor. */
const DEFAULT_AREA: AreaId = "personal_desk";

/**
 * Server-side mirror of an employee's last known discrete state, used only to build the
 * SNAPSHOT sent to newly (re)connected clients (docs/06_REALTIME_COMMUNICATION.md #2.1).
 * The frontend's own applyEvent/movement-queue (docs/13 #2, docs/10 #4) is the real-time
 * source of truth once the stream of EVENT messages starts flowing.
 */
export function applyEventToEmployee(
  current: Employee | null,
  event: InternalEvent,
  rawToolInput: Record<string, unknown> | null
): Employee | null {
  if (event.eventType === "agent_stop") return null;

  const base: Employee = current ?? {
    agentId: event.agentId,
    sessionId: event.sessionId,
    parentAgentId: event.parentAgentId,
    role: event.agentType,
    displayName: event.displayName,
    avatarVariant: Math.abs(hashCode(event.agentId)) % 8,
    state: "idle",
    areaId: DEFAULT_AREA,
    destinationAreaId: null,
    currentTask: null,
    currentTool: null,
    spawnedAt: event.timestamp,
    completedAt: null,
    hasWarning: false,
    movementQueue: [],
  };

  let state: CharacterState = base.state;
  let areaId: AreaId = base.areaId;
  let hasWarning = base.hasWarning;
  let completedAt = base.completedAt;

  switch (event.eventType) {
    case "agent_spawn":
      state = "idle";
      areaId = DEFAULT_AREA;
      break;
    case "tool_use": {
      const classification = event.toolName ? classifyTool(event.toolName, rawToolInput) : null;
      if (classification) {
        state = classification.state;
        areaId = classification.areaId;
      }
      hasWarning = false;
      break;
    }
    case "tool_result":
      state = "idle";
      areaId = DEFAULT_AREA;
      hasWarning = false;
      break;
    case "tool_error":
      state = "error";
      hasWarning = true;
      break;
    case "waiting_input":
      state = "waiting";
      break;
    case "turn_complete":
      state = "completed";
      areaId = "break_room";
      completedAt = event.timestamp;
      break;
    default:
      break;
  }

  return {
    ...base,
    role: event.agentType,
    state,
    areaId,
    destinationAreaId: areaId !== base.areaId ? areaId : base.destinationAreaId,
    currentTask: event.message || base.currentTask,
    currentTool: event.toolName ?? base.currentTool,
    hasWarning,
    completedAt,
  };
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
