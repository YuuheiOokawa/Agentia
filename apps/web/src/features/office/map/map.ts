import type { AreaId } from "@agentia/shared-types";

export interface AreaLayout {
  areaId: AreaId;
  name: string;
  icon: string;
  color: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Which horizontal corridor band this area opens onto (docs/10_OFFICE_SYSTEM.md #4.1). */
  row: number;
  /** Desk-slot grid so several employees in the same area spread out instead of stacking (docs/10 #3 deskSlots). */
  slotGrid: { cols: number; rows: number };
}

/** docs/10_OFFICE_SYSTEM.md #2: Phase 2 renders the full 12-area floor plan on one fixed-size stage. */
export const OFFICE_WIDTH = 960;
export const OFFICE_HEIGHT = 800;

const ROW_Y = [20, 200, 450, 630] as const;
const ROW_HEIGHT = [150, 220, 150, 140] as const;

export const PHASE2_AREA_LAYOUT: readonly AreaLayout[] = [
  // Row 0
  { areaId: "library", name: "本棚・資料エリア", icon: "📚", color: 0x8d6e63, x: 20, y: ROW_Y[0], width: 220, height: ROW_HEIGHT[0], row: 0, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "research_space", name: "調査・リサーチスペース", icon: "🔍", color: 0x5c6bc0, x: 260, y: ROW_Y[0], width: 220, height: ROW_HEIGHT[0], row: 0, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "meeting_room", name: "会議室", icon: "🗂", color: 0x8e24aa, x: 500, y: ROW_Y[0], width: 220, height: ROW_HEIGHT[0], row: 0, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "pm_space", name: "プロジェクト管理スペース", icon: "📋", color: 0x3949ab, x: 740, y: ROW_Y[0], width: 200, height: ROW_HEIGHT[0], row: 0, slotGrid: { cols: 2, rows: 2 } },
  // Row 1
  { areaId: "dev_floor", name: "開発デスク", icon: "💻", color: 0x1e88e5, x: 20, y: ROW_Y[1], width: 460, height: ROW_HEIGHT[1], row: 1, slotGrid: { cols: 4, rows: 2 } },
  { areaId: "personal_desk", name: "個人デスク", icon: "🪑", color: 0x90a4ae, x: 500, y: ROW_Y[1], width: 220, height: ROW_HEIGHT[1], row: 1, slotGrid: { cols: 3, rows: 3 } },
  { areaId: "server_room", name: "サーバールーム", icon: "🗄", color: 0x37474f, x: 740, y: ROW_Y[1], width: 200, height: ROW_HEIGHT[1], row: 1, slotGrid: { cols: 2, rows: 2 } },
  // Row 2
  { areaId: "terminal_room", name: "ターミナルルーム", icon: "🖥", color: 0x455a64, x: 20, y: ROW_Y[2], width: 220, height: ROW_HEIGHT[2], row: 2, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "qa_room", name: "QA・テストルーム", icon: "🧪", color: 0x43a047, x: 260, y: ROW_Y[2], width: 220, height: ROW_HEIGHT[2], row: 2, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "deploy_area", name: "デプロイエリア", icon: "🚀", color: 0xef6c00, x: 500, y: ROW_Y[2], width: 220, height: ROW_HEIGHT[2], row: 2, slotGrid: { cols: 3, rows: 2 } },
  { areaId: "github_hub", name: "GitHub連携スペース", icon: "🐙", color: 0x2b3137, x: 740, y: ROW_Y[2], width: 200, height: ROW_HEIGHT[2], row: 2, slotGrid: { cols: 2, rows: 2 } },
  // Row 3
  { areaId: "break_room", name: "休憩スペース", icon: "☕", color: 0xf9a825, x: 20, y: ROW_Y[3], width: 920, height: ROW_HEIGHT[3], row: 3, slotGrid: { cols: 7, rows: 1 } },
];

export const AREA_LAYOUT_BY_ID: ReadonlyMap<AreaId, AreaLayout> = new Map(
  PHASE2_AREA_LAYOUT.map((area) => [area.areaId, area])
);

export type FurnitureProp = "desk" | "bookshelf" | "plant" | "server" | "reception";

/** Which pixel-art prop decorates each area's desk slots (docs/10 #2 area definitions). */
export const AREA_FURNITURE: Record<AreaId, FurnitureProp> = {
  library: "bookshelf",
  research_space: "desk",
  meeting_room: "desk",
  pm_space: "desk",
  dev_floor: "desk",
  personal_desk: "desk",
  server_room: "server",
  terminal_room: "desk",
  qa_room: "desk",
  deploy_area: "desk",
  github_hub: "reception",
  break_room: "plant",
};

const CORRIDOR_X = OFFICE_WIDTH / 2;
const ROW_CORRIDOR_Y = ROW_Y.map((y, i) => y + ROW_HEIGHT[i]! / 2);

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Center point of an area (used as a fallback and for the corridor/label math). */
export function areaCenter(areaId: AreaId): { x: number; y: number } {
  const area = AREA_LAYOUT_BY_ID.get(areaId);
  if (!area) return { x: OFFICE_WIDTH / 2, y: OFFICE_HEIGHT / 2 };
  return { x: area.x + area.width / 2, y: area.y + area.height / 2 };
}

/** All desk-slot positions inside an area, arranged in its slotGrid (docs/10 #3). */
export function areaSlots(areaId: AreaId): Array<{ x: number; y: number }> {
  const area = AREA_LAYOUT_BY_ID.get(areaId);
  if (!area) return [areaCenter(areaId)];
  const { cols, rows } = area.slotGrid;
  const topPad = 40; // leave room for the area name label
  const sidePad = 24;
  const cellW = (area.width - sidePad * 2) / cols;
  const cellH = (area.height - topPad - sidePad) / rows;
  const slots: Array<{ x: number; y: number }> = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      slots.push({
        x: area.x + sidePad + cellW * (c + 0.5),
        y: area.y + topPad + cellH * (r + 0.5),
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

/**
 * docs/10_OFFICE_SYSTEM.md #4.1: characters walk to a central corridor, travel along it past any
 * intervening rows, then walk into the destination's desk slot - instead of teleporting or cutting
 * straight through walls via one shared midpoint.
 */
export function pathToArea(fromAreaId: AreaId, toAreaId: AreaId, agentId: string): Array<{ x: number; y: number }> {
  const destination = areaSlotFor(toAreaId, agentId);
  if (fromAreaId === toAreaId) return [destination];

  const fromArea = AREA_LAYOUT_BY_ID.get(fromAreaId);
  const toArea = AREA_LAYOUT_BY_ID.get(toAreaId);
  const fromRow = fromArea?.row ?? 0;
  const toRow = toArea?.row ?? 0;

  const path: Array<{ x: number; y: number }> = [{ x: CORRIDOR_X, y: ROW_CORRIDOR_Y[fromRow] ?? CORRIDOR_X }];
  const step = fromRow < toRow ? 1 : -1;
  for (let row = fromRow + step; row !== toRow; row += step) {
    path.push({ x: CORRIDOR_X, y: ROW_CORRIDOR_Y[row] ?? CORRIDOR_X });
  }
  if (fromRow !== toRow) path.push({ x: CORRIDOR_X, y: ROW_CORRIDOR_Y[toRow] ?? CORRIDOR_X });
  path.push(destination);
  return path;
}
