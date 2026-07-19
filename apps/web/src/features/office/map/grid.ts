import type { AreaId } from "@agentia/shared-types";
import { GRID_COLS, GRID_ROWS } from "./iso";
import {
  AREA_DOORS,
  AREA_LAYOUT_BY_ID,
  PHASE2_AREA_LAYOUT,
  allFurniturePlacements,
  areaDecorPlacements,
  doorCells,
} from "./map";

/**
 * STEP5: the movement grid is fully separate from the visual layer. Cell values follow the spec's
 * scheme: 0 = walkable floor, 2 = furniture (solid), 4 = work point (walkable seat in front of a
 * prop). Walls live on cell EDGES (a room's perimeter), not in cells - `canStep` forbids crossing
 * a room boundary except through a door edge (3). Rooms and corridors both count as floor.
 */
export const CELL_FLOOR = 0;
export const CELL_FURNITURE = 2;
export const CELL_WORKPOINT = 4;

export type NavCell = typeof CELL_FLOOR | typeof CELL_FURNITURE | typeof CELL_WORKPOINT;

/** Which room each cell belongs to (null = corridor / shared floor). */
const ROOM_OF: ReadonlyArray<ReadonlyArray<AreaId | null>> = (() => {
  const rows: Array<Array<AreaId | null>> = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => null as AreaId | null)
  );
  for (const area of PHASE2_AREA_LAYOUT) {
    for (let cy = area.gy; cy < area.gy + area.gh; cy += 1) {
      for (let cx = area.gx; cx < area.gx + area.gw; cx += 1) {
        rows[cy]![cx] = area.areaId;
      }
    }
  }
  return rows;
})();

/** Solid/walkable state per cell, built once from the same placements the renderer draws. */
const NAV_GRID: ReadonlyArray<ReadonlyArray<NavCell>> = (() => {
  const rows: Array<Array<NavCell>> = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => CELL_FLOOR as NavCell)
  );
  const mark = (cx: number, cy: number, value: NavCell) => {
    if (cy >= 0 && cy < GRID_ROWS && cx >= 0 && cx < GRID_COLS) rows[cy]![cx] = value;
  };
  for (const placement of allFurniturePlacements()) {
    mark(placement.cell.cx, placement.cell.cy, CELL_FURNITURE);
    mark(Math.floor(placement.seat.x), Math.floor(placement.seat.y), CELL_WORKPOINT);
  }
  for (const area of PHASE2_AREA_LAYOUT) {
    for (const decor of areaDecorPlacements(area.areaId)) {
      mark(decor.cell.cx, decor.cell.cy, CELL_FURNITURE);
    }
  }
  // A door's two cells must always stay walkable no matter what placement logic does (STEP2).
  for (const door of AREA_DOORS) {
    const { inside, outside } = doorCells(door);
    mark(inside.cx, inside.cy, CELL_FLOOR);
    mark(outside.cx, outside.cy, CELL_FLOOR);
  }
  return rows;
})();

/** Door edges as "cxA,cyA|cxB,cyB" keys (both directions) for O(1) crossing checks. */
const DOOR_EDGES: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const door of AREA_DOORS) {
    const { inside, outside } = doorCells(door);
    set.add(`${inside.cx},${inside.cy}|${outside.cx},${outside.cy}`);
    set.add(`${outside.cx},${outside.cy}|${inside.cx},${inside.cy}`);
  }
  return set;
})();

export function inBounds(cx: number, cy: number): boolean {
  return cx >= 0 && cx < GRID_COLS && cy >= 0 && cy < GRID_ROWS;
}

export function cellAt(cx: number, cy: number): NavCell {
  if (!inBounds(cx, cy)) return CELL_FURNITURE;
  return NAV_GRID[cy]![cx]!;
}

export function isWalkable(cx: number, cy: number): boolean {
  return inBounds(cx, cy) && cellAt(cx, cy) !== CELL_FURNITURE;
}

export function roomAt(cx: number, cy: number): AreaId | null {
  if (!inBounds(cx, cy)) return null;
  return ROOM_OF[cy]![cx]!;
}

/**
 * Whether a character may step between two ADJACENT cells (4-neighborhood). Enforces the STEP2
 * forbidden list: no walking through furniture, and no crossing a room's wall except at a door.
 */
export function canStep(ax: number, ay: number, bx: number, by: number): boolean {
  if (!isWalkable(bx, by) || !isWalkable(ax, ay)) return false;
  if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return false;
  const roomA = roomAt(ax, ay);
  const roomB = roomAt(bx, by);
  if (roomA === roomB) return true;
  return DOOR_EDGES.has(`${ax},${ay}|${bx},${by}`);
}

/** All walkable cells belonging to an area (used for wander/ambient targets inside a room). */
export function walkableCellsIn(areaId: AreaId): Array<{ cx: number; cy: number }> {
  const area = AREA_LAYOUT_BY_ID.get(areaId);
  if (!area) return [];
  const cells: Array<{ cx: number; cy: number }> = [];
  for (let cy = area.gy; cy < area.gy + area.gh; cy += 1) {
    for (let cx = area.gx; cx < area.gx + area.gw; cx += 1) {
      if (isWalkable(cx, cy)) cells.push({ cx, cy });
    }
  }
  return cells;
}

/** Nearest walkable cell to a world-tile point, searching outward ring by ring (for snapping a
 * character's continuous position onto the grid before running A*). */
export function nearestWalkableCell(x: number, y: number): { cx: number; cy: number } {
  const cx0 = Math.min(GRID_COLS - 1, Math.max(0, Math.floor(x)));
  const cy0 = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(y)));
  if (isWalkable(cx0, cy0)) return { cx: cx0, cy: cy0 };
  for (let r = 1; r < Math.max(GRID_COLS, GRID_ROWS); r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isWalkable(cx0 + dx, cy0 + dy)) return { cx: cx0 + dx, cy: cy0 + dy };
      }
    }
  }
  return { cx: cx0, cy: cy0 };
}
