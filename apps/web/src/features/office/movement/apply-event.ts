import { classifyTool } from "@agentia/shared-types";
import type { AreaId, CharacterState, Employee, InternalEvent } from "@agentia/shared-types";
import { applyDesiredStep, priorityForState, type DesiredStep } from "./movement-queue";

/** docs/09_CHARACTER_SYSTEM.md #3: idle characters rest at their own desk, not the active work floor. */
const DEFAULT_AREA: AreaId = "personal_desk";

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function createEmployee(event: InternalEvent): Employee {
  return {
    agentId: event.agentId,
    sessionId: event.sessionId,
    projectId: event.projectId,
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
}

/**
 * docs/13_FRONTEND_DESIGN.md #2 applyEvent: the client's discrete reducer over one WS EVENT.
 * `rawToolInput` is best-effort (MVP has no side channel for it — Bash target strings already
 * ride along in event.target, which is enough for classification's Bash pattern matching).
 */
export function applyEvent(employees: Record<string, Employee>, event: InternalEvent): Record<string, Employee> {
  if (event.eventType === "agent_stop") {
    const next = { ...employees };
    delete next[event.agentId];
    return next;
  }

  const existing = employees[event.agentId] ?? createEmployee(event);
  let desired: DesiredStep | null = null;
  let hasWarning = existing.hasWarning;
  let completedAt = existing.completedAt;

  switch (event.eventType) {
    case "agent_spawn":
      desired = { eventId: event.eventId, state: "idle", areaId: DEFAULT_AREA, priority: priorityForState("idle") };
      break;
    case "tool_use": {
      const toolInput = event.toolName === "Bash" && event.target ? { command: event.target } : null;
      const classification = event.toolName ? classifyTool(event.toolName, toolInput) : null;
      if (classification) {
        desired = {
          eventId: event.eventId,
          state: classification.state,
          areaId: classification.areaId,
          priority: priorityForState(classification.state),
        };
      }
      hasWarning = false;
      break;
    }
    case "tool_result":
      desired = { eventId: event.eventId, state: "idle", areaId: DEFAULT_AREA, priority: priorityForState("idle") };
      hasWarning = false;
      break;
    case "tool_error":
      desired = { eventId: event.eventId, state: "error", areaId: existing.areaId, priority: priorityForState("error") };
      hasWarning = true;
      break;
    case "waiting_input":
      desired = { eventId: event.eventId, state: "waiting", areaId: existing.areaId, priority: priorityForState("waiting") };
      break;
    case "turn_complete":
      desired = { eventId: event.eventId, state: "completed", areaId: "break_room", priority: priorityForState("completed") };
      completedAt = event.timestamp;
      break;
    default:
      break;
  }

  const movementSlice = desired
    ? applyDesiredStep(
        { areaId: existing.areaId, state: existing.state, destinationAreaId: existing.destinationAreaId, movementQueue: existing.movementQueue },
        desired
      )
    : { areaId: existing.areaId, state: existing.state, destinationAreaId: existing.destinationAreaId, movementQueue: existing.movementQueue };

  const updated: Employee = {
    ...existing,
    role: event.agentType,
    ...movementSlice,
    currentTask: event.message || existing.currentTask,
    currentTool: event.toolName ?? existing.currentTool,
    hasWarning,
    completedAt,
  };

  return { ...employees, [event.agentId]: updated };
}

/** docs/10_OFFICE_SYSTEM.md #4.2: called on a fixed cadence to drain each employee's queued steps. */
export function drainAllQueues(
  employees: Record<string, Employee>,
  drainQueueFn: (slice: {
    areaId: AreaId;
    state: CharacterState;
    destinationAreaId: AreaId | null;
    movementQueue: Employee["movementQueue"];
  }) => { areaId: AreaId; state: CharacterState; destinationAreaId: AreaId | null; movementQueue: Employee["movementQueue"] }
): Record<string, Employee> {
  const next: Record<string, Employee> = {};
  for (const [agentId, employee] of Object.entries(employees)) {
    if (employee.movementQueue.length === 0) {
      next[agentId] = employee;
      continue;
    }
    const slice = drainQueueFn(employee);
    next[agentId] = { ...employee, ...slice };
  }
  return next;
}
