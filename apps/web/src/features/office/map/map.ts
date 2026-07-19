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
  | "vending_machine"
  | "water_server"
  | "trash";

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
  break_room: ["couch", "vending_machine", "plant", "water_server", "couch", "trash", "plant"],
};

/** A single extra decorative prop per area, parked against the room's back wall. */
export const AREA_ACCESSORY: Partial<Record<AreaId, FurnitureProp>> = {
  meeting_room: "whiteboard",
  pm_space: "whiteboard",
  personal_desk: "cabinet",
  library: "cabinet",
};

/**
 * docs/10 + STEP2: every room has explicit doorways. A door is a gap in one wall edge - crossing a
 * room boundary anywhere else is forbidden (enforced by the nav grid in grid.ts, rendered as a wall
 * gap + threshold in OfficeCanvas). `cx` is the tile column of the gap; the door connects the cell
 * just inside the room with the corridor cell just outside.
 */
export interface Door {
  areaId: AreaId;
  side: "north" | "south";
  cx: number;
}

export const AREA_DOORS: readonly Door[] = PHASE2_AREA_LAYOUT.flatMap((area): Door[] => {
  const cx = area.gx + Math.floor(area.gw / 2);
  if (area.row === 0) return [{ areaId: area.areaId, side: "south", cx }];
  if (area.areaId === "break_room") {
    // The break room spans the whole front - two doors so both ends of the office reach it quickly.
    return [
      { areaId: area.areaId, side: "north", cx: area.gx + 5 },
      { areaId: area.areaId, side: "north", cx: area.gx + 21 },
    ];
  }
  // Middle bands have a corridor on both sides - a door in each keeps A* paths natural and short.
  return [
    { areaId: area.areaId, side: "north", cx },
    { areaId: area.areaId, side: "south", cx },
  ];
});

/** The two tile cells (inside the room / outside in the corridor) a door connects. */
export function doorCells(door: Door): { inside: { cx: number; cy: number }; outside: { cx: number; cy: number } } {
  const area = AREA_LAYOUT_BY_ID.get(door.areaId)!;
  if (door.side === "north") {
    return { inside: { cx: door.cx, cy: area.gy }, outside: { cx: door.cx, cy: area.gy - 1 } };
  }
  return { inside: { cx: door.cx, cy: area.gy + area.gh - 1 }, outside: { cx: door.cx, cy: area.gy + area.gh } };
}

/**
 * STEP2/5/8: furniture lives on integer tile cells so the nav grid can mark exactly those cells
 * solid - characters route around them instead of clipping through. Each placement also carries its
 * SEAT (the walkable work-point cell just south of the prop, where a character stands/sits to use
 * it). This is the single source of truth shared by the renderer (OfficeCanvas) and the nav grid.
 */
export interface FurniturePlacement {
  areaId: AreaId;
  prop: FurnitureProp;
  /** Tile cell the prop occupies (blocked in the nav grid). */
  cell: { cx: number; cy: number };
  /** World-tile point where a character stands to use the prop (kept walkable). */
  seat: { x: number; y: number };
}

const DOOR_COLUMNS_BY_AREA: ReadonlyMap<AreaId, Set<number>> = (() => {
  const map = new Map<AreaId, Set<number>>();
  for (const door of AREA_DOORS) {
    const set = map.get(door.areaId) ?? new Set<number>();
    set.add(door.cx);
    map.set(door.areaId, set);
  }
  return map;
})();

/** How far into the seat cell (from the desk's south edge) a seated character stands - slightly
 * north of the cell center so they overlap the desk front and read as sitting at it. */
const SEAT_INSET_Y = 0.18;

function placementsForArea(area: AreaLayout): FurniturePlacement[] {
  const furniture = AREA_FURNITURE[area.areaId];
  const props = Array.isArray(furniture) ? furniture : [furniture];
  const doorCols = DOOR_COLUMNS_BY_AREA.get(area.areaId) ?? new Set<number>();

  // Candidate columns: every other interior cell, skipping door columns so no prop ever sits in a
  // doorway's line (STEP2 forbidden list: entrances must never be blocked by furniture).
  const columns: number[] = [];
  for (let cx = area.gx + 1; cx <= area.gx + area.gw - 2; cx += 2) {
    if (!doorCols.has(cx)) columns.push(cx);
  }
  // Rows come in furniture+seat pairs from the top; the seat row must stay inside the room.
  const rows: number[] = [];
  for (let cy = area.gy + 1; cy + 1 <= area.gy + area.gh - 1 && rows.length < area.slotGrid.rows; cy += 2) {
    rows.push(cy);
  }
  // Cap column count to the layout's intent, sampling evenly across the room's width.
  const targetCols = Math.min(columns.length, area.slotGrid.cols);
  const chosen: number[] = [];
  for (let i = 0; i < targetCols; i += 1) {
    const idx = targetCols === 1 ? 0 : Math.round((i * (columns.length - 1)) / (targetCols - 1));
    const cx = columns[idx]!;
    if (!chosen.includes(cx)) chosen.push(cx);
  }

  const placements: FurniturePlacement[] = [];
  let index = 0;
  for (const cy of rows) {
    for (const cx of chosen) {
      placements.push({
        areaId: area.areaId,
        prop: props[index % props.length]!,
        cell: { cx, cy },
        seat: { x: cx + 0.5, y: cy + 1 + SEAT_INSET_Y },
      });
      index += 1;
    }
  }
  return placements;
}

const PLACEMENTS_BY_AREA: ReadonlyMap<AreaId, FurniturePlacement[]> = new Map(
  PHASE2_AREA_LAYOUT.map((area) => [area.areaId, placementsForArea(area)])
);

export function areaFurniturePlacements(areaId: AreaId): FurniturePlacement[] {
  return PLACEMENTS_BY_AREA.get(areaId) ?? [];
}

export function allFurniturePlacements(): FurniturePlacement[] {
  return PHASE2_AREA_LAYOUT.flatMap((area) => PLACEMENTS_BY_AREA.get(area.areaId) ?? []);
}

/** Corner plants / back-wall accessories also occupy their cell in the nav grid (STEP8: decorations
 * are tied to collision so they never silently block a doorway). */
export interface DecorPlacement {
  prop: FurnitureProp;
  cell: { cx: number; cy: number };
  scale: number;
}

export const PLANTED_ROOMS: ReadonlySet<AreaId> = new Set([
  "library",
  "research_space",
  "meeting_room",
  "pm_space",
  "dev_floor",
  "personal_desk",
  "terminal_room",
  "qa_room",
  "deploy_area",
] as AreaId[]);

export function areaDecorPlacements(areaId: AreaId): DecorPlacement[] {
  const area = AREA_LAYOUT_BY_ID.get(areaId);
  if (!area) return [];
  const decor: DecorPlacement[] = [];
  const doorCols = DOOR_COLUMNS_BY_AREA.get(areaId) ?? new Set<number>();
  if (PLANTED_ROOMS.has(areaId)) {
    const cx = area.gx;
    const cy = area.gy + area.gh - 1;
    if (!doorCols.has(cx)) decor.push({ prop: "plant", cell: { cx, cy }, scale: 0.26 });
  }
  const accessory = AREA_ACCESSORY[areaId];
  if (accessory) {
    decor.push({ prop: accessory, cell: { cx: area.gx + area.gw - 2, cy: area.gy }, scale: 0.42 });
  }
  return decor;
}

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

/** Deterministically assigns one employee to one desk seat so simultaneous coworkers don't overlap.
 * Returns the SEAT position (the walkable work-point in front of the furniture), never the
 * furniture's own solid cell. Path planning to the seat is A* over the nav grid (pathfinding.ts). */
export function areaSlotFor(areaId: AreaId, agentId: string): { x: number; y: number } {
  const placements = areaFurniturePlacements(areaId);
  if (placements.length === 0) return areaCenter(areaId);
  const placement = placements[hashCode(agentId) % placements.length];
  return placement ? { ...placement.seat } : areaCenter(areaId);
}
