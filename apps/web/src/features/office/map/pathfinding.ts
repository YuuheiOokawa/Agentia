import { GRID_COLS, GRID_ROWS } from "./iso";
import { canStep, isWalkable, nearestWalkableCell } from "./grid";

export interface Point {
  x: number;
  y: number;
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function cellCenter(cx: number, cy: number): Point {
  return { x: cx + 0.5, y: cy + 0.5 };
}

/**
 * STEP5: A* over the nav grid (4-neighborhood, unit costs, Manhattan heuristic - admissible, so
 * paths are optimal). The grid is 27x19 so this is microseconds per call; it runs only when a
 * character picks a new destination, never per frame.
 *
 * Input/output are continuous world-tile points: the start is snapped to its nearest walkable
 * cell, the returned waypoints are cell centers (collinear runs compressed), and the exact goal
 * point is appended so characters settle on seats/wander targets, not just cell centers.
 */
export function findPath(start: Point, goal: Point): Point[] {
  const startCell = nearestWalkableCell(start.x, start.y);
  const goalCell = nearestWalkableCell(goal.x, goal.y);

  const startIdx = startCell.cy * GRID_COLS + startCell.cx;
  const goalIdx = goalCell.cy * GRID_COLS + goalCell.cx;

  if (startIdx === goalIdx) {
    return isWalkable(Math.floor(goal.x), Math.floor(goal.y)) ? [goal] : [cellCenter(goalCell.cx, goalCell.cy)];
  }

  const total = GRID_COLS * GRID_ROWS;
  const gScore = new Float64Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  gScore[startIdx] = 0;

  // Simple array-backed open set: fine at this grid size (<= 513 cells).
  const open: number[] = [startIdx];
  const fScore = new Float64Array(total).fill(Infinity);
  const h = (idx: number) => {
    const cx = idx % GRID_COLS;
    const cy = Math.floor(idx / GRID_COLS);
    return Math.abs(cx - goalCell.cx) + Math.abs(cy - goalCell.cy);
  };
  fScore[startIdx] = h(startIdx);

  let found = false;
  while (open.length > 0) {
    let bestI = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (fScore[open[i]!]! < fScore[open[bestI]!]!) bestI = i;
    }
    const current = open.splice(bestI, 1)[0]!;
    if (current === goalIdx) {
      found = true;
      break;
    }
    closed[current] = 1;
    const cx = current % GRID_COLS;
    const cy = Math.floor(current / GRID_COLS);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!canStep(cx, cy, nx, ny)) continue;
      const nIdx = ny * GRID_COLS + nx;
      if (closed[nIdx]) continue;
      const tentative = gScore[current]! + 1;
      if (tentative < gScore[nIdx]!) {
        gScore[nIdx] = tentative;
        fScore[nIdx] = tentative + h(nIdx);
        cameFrom[nIdx] = current;
        if (!open.includes(nIdx)) open.push(nIdx);
      }
    }
  }

  if (!found) return [cellCenter(goalCell.cx, goalCell.cy)];

  const cells: Array<{ cx: number; cy: number }> = [];
  for (let idx = goalIdx; idx !== -1; idx = cameFrom[idx]!) {
    cells.push({ cx: idx % GRID_COLS, cy: Math.floor(idx / GRID_COLS) });
  }
  cells.reverse();

  // Compress collinear runs so characters glide down a corridor in one motion instead of
  // twitching at every cell center.
  const waypoints: Point[] = [];
  for (let i = 1; i < cells.length; i += 1) {
    const prev = cells[i - 1]!;
    const cur = cells[i]!;
    const next = cells[i + 1];
    const dir1 = { x: cur.cx - prev.cx, y: cur.cy - prev.cy };
    const dir2 = next ? { x: next.cx - cur.cx, y: next.cy - cur.cy } : null;
    if (!dir2 || dir1.x !== dir2.x || dir1.y !== dir2.y) {
      waypoints.push(cellCenter(cur.cx, cur.cy));
    }
  }

  // Settle on the exact requested point when it lies in the goal cell (seat positions do).
  const last = waypoints[waypoints.length - 1];
  if (Math.floor(goal.x) === goalCell.cx && Math.floor(goal.y) === goalCell.cy) {
    if (last) waypoints[waypoints.length - 1] = goal;
    else waypoints.push(goal);
  }
  return waypoints;
}
