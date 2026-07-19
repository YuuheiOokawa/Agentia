import type { AreaId } from "@agentia/shared-types";
import { GRID_COLS, GRID_ROWS } from "./iso";

/**
 * docs/10_OFFICE_SYSTEM.md #2 + docs/07 "カイロソフト風": the floor plan now lives in isometric
 * WORLD space (tile units, see iso.ts), not screen pixels. Every position this module hands out -
 * slots, wander bounds, corridor paths - is in tiles; rendering converts via isoToScreen().
 */
export interface AreaLayout {
  areaId: AreaId;
  name: string;
  icon: string;
  color: number;
  /** Room rect in tile units. */
  gx: number;
  gy: number;
  gw: number;
  gh: number;
  /** Which horizontal band this area sits in (bands are separated by walk corridors). */
  row: number;
  /** Desk-slot grid so several employees in the same area spread out instead of stacking (docs/10 #3). */
  slotGrid: { cols: number; rows: number };
}

/** 27x19-tile floor: four room bands with 1-tile corridors between them (y=4/10/15) and a shared
 * vertical corridor column at x=20 that is open in every band - characters travel through these. */
export const PHASE2_AREA_LAYOUT: readonly AreaLayout[] = [
  // Band 0 (back wall of the building)
  { areaId: "library", name: "本棚・資料エリア", icon: "📚", color: 0x8d6e63, gx: 0, gy: 0, gw: 6, gh: 4, row: 0, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "research_space", name: "調査・リサーチスペース", icon: "🔍", color: 0x5c6bc0, gx: 7, gy: 0, gw: 6, gh: 4, row: 0, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "meeting_room", name: "会議室", icon: "🗂", color: 0x8e24aa, gx: 14, gy: 0, gw: 6, gh: 4, row: 0, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "pm_space", name: "プロジェクト管理スペース", icon: "📋", color: 0x3949ab, gx: 21, gy: 0, gw: 6, gh: 4, row: 0, slotGrid: { cols: 2, rows: 2 } },
  // Band 1
  { areaId: "dev_floor", name: "開発デスク", icon: "💻", color: 0x1e88e5, gx: 0, gy: 5, gw: 12, gh: 5, row: 1, slotGrid: { cols: 4, rows: 2 } },
  { areaId: "personal_desk", name: "個人デスク", icon: "🪑", color: 0x90a4ae, gx: 13, gy: 5, gw: 7, gh: 5, row: 1, slotGrid: { cols: 3, rows: 3 } },
  { areaId: "server_room", name: "サーバールーム", icon: "🗄", color: 0x37474f, gx: 21, gy: 5, gw: 6, gh: 5, row: 1, slotGrid: { cols: 2, rows: 2 } },
  // Band 2
  { areaId: "terminal_room", name: "ターミナルルーム", icon: "🖥", color: 0x455a64, gx: 0, gy: 11, gw: 6, gh: 4, row: 2, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "qa_room", name: "QA・テストルーム", icon: "🧪", color: 0x43a047, gx: 7, gy: 11, gw: 6, gh: 4, row: 2, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "deploy_area", name: "デプロイエリア", icon: "🚀", color: 0xef6c00, gx: 14, gy: 11, gw: 6, gh: 4, row: 2, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "github_hub", name: "GitHub連携スペース", icon: "🐙", color: 0x2b3137, gx: 21, gy: 11, gw: 6, gh: 4, row: 2, slotGrid: { cols: 2, rows: 2 } },
  // Band 3 (front of the building)
  { areaId: "break_room", name: "休憩スペース", icon: "☕", color: 0xf9a825, gx: 0, gy: 16, gw: GRID_COLS, gh: 3, row: 3, slotGrid: { cols: 7, rows: 1 } },
];

export const AREA_LAYOUT_BY_ID: ReadonlyMap<AreaId, AreaLayout> = new Map(
  PHASE2_AREA_LAYOUT.map((area) => [area.areaId, area])
);

export type FurnitureProp =
  | "desk"
  | "bookshelf"
  | "plant"
  | "server"
  | "reception"
  | "whiteboard"
  | "cabinet"
  | "conference_table"
  | "monitor_wall"
  | "couch"
  | "vending_machine";

/** Which pixel-art prop decorates each area's desk slots (docs/10 #2 area definitions). A list cycles
 * across slots by index instead of repeating one prop, for rooms that should read as more varied. */
export const AREA_FURNITURE: Record<AreaId, FurnitureProp | FurnitureProp[]> = {
  library: "bookshelf",
  research_space: "desk",
  meeting_room: "conference_table",
  pm_space: "desk",
  dev_floor: "desk",
  personal_desk: "desk",
  server_room: "server",
  terminal_room: "desk",
  qa_room: "desk",
  deploy_area: "desk",
  github_hub: "monitor_wall",
  break_room: ["plant", "couch", "vending_machine"],
};

/** A single extra decorative prop per area, parked against the room's back wall. */
export const AREA_ACCESSORY: Partial<Record<AreaId, FurnitureProp>> = {
  meeting_room: "whiteboard",
  pm_space: "whiteboard",
  personal_desk: "cabinet",
  library: "cabinet",
};

/** The one vertical corridor column open in every band (x=20 is a wall gap in bands 0-2). */
const CORRIDOR_X = 20.5;
/** World-y center of the walk corridor below each band boundary (between bands 0/1, 1/2, 2/3). */
const GAP_Y = [4.5, 10.5, 15.5] as const;

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Center point of an area in world tiles. */
export function areaCenter(areaId: AreaId): { x: number; y: number } {
  const area = AREA_LAYOUT_BY_ID.get(areaId);
  if (!area) return { x: GRID_COLS / 2, y: GRID_ROWS / 2 };
  return { x: area.gx + area.gw / 2, y: area.gy + area.gh / 2 };
}

/** The interior rect (world tiles) a character may roam without standing inside a wall. */
export function areaWanderBounds(areaId: AreaId): { x: number; y: number; width: number; height: number } {
  const area = AREA_LAYOUT_BY_ID.get(areaId);
  if (!area) return { x: 0, y: 0, width: GRID_COLS, height: GRID_ROWS };
  return { x: area.gx + 0.9, y: area.gy + 1.0, width: area.gw - 1.8, height: area.gh - 1.6 };
}

/** All desk-slot positions inside an area (world tiles), arranged in its slotGrid (docs/10 #3). */
export function areaSlots(areaId: AreaId): Array<{ x: number; y: number }> {
  const area = AREA_LAYOUT_BY_ID.get(areaId);
  if (!area) return [areaCenter(areaId)];
  const { cols, rows } = area.slotGrid;
  const sidePad = 0.9;
  const topPad = 1.1;
  const bottomPad = 0.5;
  const cellW = (area.gw - sidePad * 2) / cols;
  const cellH = (area.gh - topPad - bottomPad) / rows;
  const slots: Array<{ x: number; y: number }> = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      slots.push({
        x: area.gx + sidePad + cellW * (c + 0.5),
        y: area.gy + topPad + cellH * (r + 0.5),
      });
    }
  }
  return slots;
}

/** Deterministically assigns one employee to one desk slot so simultaneous coworkers don't overlap. */
export function areaSlotFor(areaId: AreaId, agentId: string): { x: number; y: number } {
  const slots = areaSlots(areaId);
  if (slots.length === 0) return areaCenter(areaId);
  const slot = slots[hashCode(agentId) % slots.length];
  return slot ?? areaCenter(areaId);
}

/** The corridor row a character exits into when leaving `row` heading toward `towardRow`. */
function corridorFor(row: number, towardRow: number): number {
  if (towardRow > row) return GAP_Y[Math.min(row, GAP_Y.length - 1)]!;
  if (towardRow < row) return GAP_Y[Math.max(row - 1, 0)]!;
  return GAP_Y[Math.min(row, GAP_Y.length - 1)]!;
}

/**
 * docs/10_OFFICE_SYSTEM.md #4.1, now corridor-accurate for the iso view: characters step out of
 * their room into the nearest walk corridor, travel along it (and the shared vertical corridor at
 * x=20.5 when changing bands), then step into the destination room - so with visible walls they
 * read as walking the hallways instead of cutting through rooms.
 */
export function pathToArea(fromAreaId: AreaId, toAreaId: AreaId, agentId: string): Array<{ x: number; y: number }> {
  const destination = areaSlotFor(toAreaId, agentId);
  if (fromAreaId === toAreaId) return [destination];

  const fromArea = AREA_LAYOUT_BY_ID.get(fromAreaId);
  const toArea = AREA_LAYOUT_BY_ID.get(toAreaId);
  const fromRow = fromArea?.row ?? 0;
  const toRow = toArea?.row ?? 0;
  const fromCenter = areaCenter(fromAreaId);

  const exitY = corridorFor(fromRow, toRow);
  const enterY = corridorFor(toRow, fromRow);

  const path: Array<{ x: number; y: number }> = [{ x: fromCenter.x, y: exitY }];
  if (fromRow !== toRow) {
    path.push({ x: CORRIDOR_X, y: exitY });
    path.push({ x: CORRIDOR_X, y: enterY });
  }
  path.push({ x: destination.x, y: enterY });
  path.push(destination);
  return path;
}
