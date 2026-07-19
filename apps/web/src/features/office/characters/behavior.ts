import type { AreaId } from "@agentia/shared-types";
import { walkableCellsIn } from "../map/grid";

/**
 * docs/10 #6 + STEP9: ambient "life" behavior for employees with no real work in flight.
 * These are RENDERING-LAYER flourishes only - the store's state/areaId (driven by real Claude
 * Code events) is never touched, and any real event interrupts the stroll immediately because
 * CharacterSprite re-plans its path the moment employee.areaId changes.
 */
export type AmbientPhase = "none" | "going" | "away" | "returning";

export interface AmbientState {
  phase: AmbientPhase;
  /** While "away": timestamp when the character heads back to their own seat. */
  until: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A random walkable spot inside the employee's own room (look-around wandering). */
export function pickWanderTarget(areaId: AreaId): Point | null {
  const cells = walkableCellsIn(areaId);
  if (cells.length === 0) return null;
  const cell = cells[Math.floor(Math.random() * cells.length)]!;
  return { x: cell.cx + 0.5, y: cell.cy + 0.5 };
}

/** A spot in the break room (getting a drink / stretching by the couches, STEP9). */
export function pickBreakSpot(): Point | null {
  return pickWanderTarget("break_room");
}

/** Chance per wander tick that an idle employee takes a break-room trip instead of pacing their room. */
export const AMBIENT_TRIP_CHANCE = 0.25;
/** How long an employee lingers in the break room before strolling back to their seat. */
export const AMBIENT_PAUSE_MIN_MS = 2500;
export const AMBIENT_PAUSE_MAX_MS = 6000;
