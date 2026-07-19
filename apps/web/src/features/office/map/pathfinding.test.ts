import { describe, expect, it } from "vitest";
import { AREA_IDS } from "@agentia/shared-types";
import { canStep, cellAt, CELL_FURNITURE, isWalkable, roomAt, walkableCellsIn } from "./grid";
import { findPath } from "./pathfinding";
import { AREA_DOORS, allFurniturePlacements, areaSlotFor, doorCells } from "./map";

/** Expands compressed waypoints back into unit cell steps so we can audit every crossing. */
function stepsOf(start: { x: number; y: number }, waypoints: Array<{ x: number; y: number }>) {
  const cells: Array<{ cx: number; cy: number }> = [{ cx: Math.floor(start.x), cy: Math.floor(start.y) }];
  for (const wp of waypoints) {
    const target = { cx: Math.floor(wp.x), cy: Math.floor(wp.y) };
    let { cx, cy } = cells[cells.length - 1]!;
    while (cx !== target.cx || cy !== target.cy) {
      if (cx !== target.cx) cx += Math.sign(target.cx - cx);
      else cy += Math.sign(target.cy - cy);
      cells.push({ cx, cy });
    }
  }
  return cells;
}

describe("nav grid", () => {
  it("marks furniture cells solid and their seats walkable", () => {
    for (const placement of allFurniturePlacements()) {
      expect(cellAt(placement.cell.cx, placement.cell.cy)).toBe(CELL_FURNITURE);
      expect(isWalkable(Math.floor(placement.seat.x), Math.floor(placement.seat.y))).toBe(true);
    }
  });

  it("keeps both cells of every door walkable", () => {
    for (const door of AREA_DOORS) {
      const { inside, outside } = doorCells(door);
      expect(isWalkable(inside.cx, inside.cy)).toBe(true);
      expect(isWalkable(outside.cx, outside.cy)).toBe(true);
      expect(canStep(inside.cx, inside.cy, outside.cx, outside.cy)).toBe(true);
    }
  });

  it("forbids crossing a room boundary anywhere except a door", () => {
    // library's south wall: only the door column may be crossed.
    const doorCx = AREA_DOORS.find((d) => d.areaId === "library")!.cx;
    for (let cx = 0; cx < 6; cx += 1) {
      expect(canStep(cx, 3, cx, 4)).toBe(cx === doorCx);
    }
  });

  it("every area has at least one door and walkable interior cells", () => {
    for (const areaId of AREA_IDS) {
      expect(AREA_DOORS.some((d) => d.areaId === areaId)).toBe(true);
      expect(walkableCellsIn(areaId).length).toBeGreaterThan(0);
    }
  });
});

describe("findPath (A*)", () => {
  it("finds a legal path between every pair of areas' seats", () => {
    for (const fromArea of AREA_IDS) {
      for (const toArea of AREA_IDS) {
        if (fromArea === toArea) continue;
        const start = areaSlotFor(fromArea, "agent-1");
        const goal = areaSlotFor(toArea, "agent-1");
        const path = findPath(start, goal);
        expect(path.length).toBeGreaterThan(0);
        const last = path[path.length - 1]!;
        expect(Math.hypot(last.x - goal.x, last.y - goal.y)).toBeLessThan(0.001);
        // Audit every unit step: never through furniture, never through a wall.
        const cells = stepsOf(start, path);
        for (let i = 1; i < cells.length; i += 1) {
          const a = cells[i - 1]!;
          const b = cells[i]!;
          expect(
            canStep(a.cx, a.cy, b.cx, b.cy),
            `illegal step ${fromArea}->${toArea} at (${a.cx},${a.cy})->(${b.cx},${b.cy}) room ${roomAt(a.cx, a.cy)}->${roomAt(b.cx, b.cy)}`
          ).toBe(true);
        }
      }
    }
  });

  it("routes through the corridor, not through walls, when changing bands", () => {
    const start = areaSlotFor("library", "a");
    const goal = areaSlotFor("qa_room", "a");
    const cells = stepsOf(start, findPath(start, goal));
    // Must pass through library's south door column and some corridor cells (room === null).
    expect(cells.some((c) => roomAt(c.cx, c.cy) === null)).toBe(true);
  });

  it("stays inside the room when wandering within one area", () => {
    const start = areaSlotFor("dev_floor", "a");
    const goal = areaSlotFor("dev_floor", "b");
    const cells = stepsOf(start, findPath(start, goal));
    for (const c of cells) expect(roomAt(c.cx, c.cy)).toBe("dev_floor");
  });
});
