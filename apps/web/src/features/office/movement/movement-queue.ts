import type { AreaId, CharacterState, MovementStep } from "@agentia/shared-types";
import {
  EVENT_PRIORITY_ERROR,
  EVENT_PRIORITY_IDLE,
  EVENT_PRIORITY_WAITING,
  EVENT_PRIORITY_WORK,
  MOVEMENT_QUEUE_MAX_LENGTH,
} from "@/lib/constants";

export interface DesiredStep {
  eventId: string;
  state: CharacterState;
  areaId: AreaId;
  priority: number;
}

/** docs/09_CHARACTER_SYSTEM.md #3.2 priority rule. */
export function priorityForState(state: CharacterState): number {
  if (state === "error") return EVENT_PRIORITY_ERROR;
  if (state === "waiting") return EVENT_PRIORITY_WAITING;
  if (state === "idle" || state === "completed") return EVENT_PRIORITY_IDLE;
  return EVENT_PRIORITY_WORK;
}

export interface MovementQueueSlice {
  areaId: AreaId;
  state: CharacterState;
  destinationAreaId: AreaId | null;
  movementQueue: MovementStep[];
}

/**
 * docs/10_OFFICE_SYSTEM.md #4.2: a strictly-higher priority step interrupts and replaces
 * whatever is in flight; a same-or-lower priority step is queued (dropping the oldest
 * queued step once MOVEMENT_QUEUE_MAX_LENGTH is exceeded) instead of yanking the character
 * back and forth between two same-tier destinations.
 */
export function applyDesiredStep(current: MovementQueueSlice, step: DesiredStep): MovementQueueSlice {
  const currentPriority = priorityForState(current.state);
  const isIdleLike = current.movementQueue.length === 0 && current.destinationAreaId === null;

  if (isIdleLike || step.priority > currentPriority) {
    return {
      areaId: step.areaId,
      state: step.state,
      destinationAreaId: step.areaId,
      movementQueue: [],
    };
  }

  const queued: MovementStep = { destinationAreaId: step.areaId, eventId: step.eventId, priority: step.priority };
  const nextQueue = [...current.movementQueue, queued].slice(-MOVEMENT_QUEUE_MAX_LENGTH);
  return { ...current, movementQueue: nextQueue };
}

/** Pops the next queued step (called by a fixed-cadence ticker) once the in-flight step has settled. */
export function drainQueue(current: MovementQueueSlice, resolvedState: CharacterState): MovementQueueSlice {
  const [next, ...rest] = current.movementQueue;
  if (!next) return { ...current, destinationAreaId: null };
  return {
    areaId: next.destinationAreaId,
    state: resolvedState,
    destinationAreaId: next.destinationAreaId,
    movementQueue: rest,
  };
}
