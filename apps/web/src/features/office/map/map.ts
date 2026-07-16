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
}

/** docs/10_OFFICE_SYSTEM.md #2/#3: MVP renders only the 6 MVP-enabled areas on one fixed 800x560 floor. */
export const OFFICE_WIDTH = 800;
export const OFFICE_HEIGHT = 560;

export const MVP_AREA_LAYOUT: readonly AreaLayout[] = [
  { areaId: "library", name: "本棚・資料エリア", icon: "📚", color: 0x8d6e63, x: 20, y: 20, width: 230, height: 150 },
  { areaId: "research_space", name: "調査・リサーチスペース", icon: "🔍", color: 0x5c6bc0, x: 270, y: 20, width: 230, height: 150 },
  { areaId: "dev_floor", name: "開発デスク", icon: "💻", color: 0x1e88e5, x: 520, y: 20, width: 260, height: 310 },
  { areaId: "terminal_room", name: "ターミナルルーム", icon: "🖥", color: 0x455a64, x: 20, y: 190, width: 230, height: 140 },
  { areaId: "qa_room", name: "QA・テストルーム", icon: "🧪", color: 0x43a047, x: 270, y: 190, width: 230, height: 140 },
  { areaId: "break_room", name: "休憩スペース", icon: "☕", color: 0xf9a825, x: 20, y: 350, width: 480, height: 130 },
];

export const AREA_LAYOUT_BY_ID: ReadonlyMap<AreaId, AreaLayout> = new Map(
  MVP_AREA_LAYOUT.map((area) => [area.areaId, area])
);

/** Center point of an area, used both as its entry point and its desk position. */
export function areaCenter(areaId: AreaId): { x: number; y: number } {
  const area = AREA_LAYOUT_BY_ID.get(areaId);
  if (!area) return { x: OFFICE_WIDTH / 2, y: OFFICE_HEIGHT / 2 };
  return { x: area.x + area.width / 2, y: area.y + area.height / 2 };
}

/** docs/10_OFFICE_SYSTEM.md #4.1: a single shared corridor node keeps MVP pathing simple (2-hop walk). */
export const CORRIDOR_WAYPOINT = { x: OFFICE_WIDTH / 2, y: OFFICE_HEIGHT / 2 };

export function pathToArea(fromAreaId: AreaId, toAreaId: AreaId): Array<{ x: number; y: number }> {
  if (fromAreaId === toAreaId) return [areaCenter(toAreaId)];
  return [CORRIDOR_WAYPOINT, areaCenter(toAreaId)];
}
