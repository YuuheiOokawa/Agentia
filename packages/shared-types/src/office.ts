/** docs/10_OFFICE_SYSTEM.md #2 area list. MVP renders only `mvpEnabled` areas (docs/17_MVP_PLAN.md #1). */
export const AREA_IDS = [
  "dev_floor",
  "personal_desk",
  "meeting_room",
  "research_space",
  "library",
  "terminal_room",
  "qa_room",
  "deploy_area",
  "server_room",
  "break_room",
  "github_hub",
  "pm_space",
] as const;
export type AreaId = (typeof AREA_IDS)[number];

export interface AreaDefinition {
  areaId: AreaId;
  name: string;
  mvpEnabled: boolean;
}

export const AREA_DEFINITIONS: Record<AreaId, AreaDefinition> = {
  dev_floor: { areaId: "dev_floor", name: "開発デスク", mvpEnabled: true },
  personal_desk: { areaId: "personal_desk", name: "個人デスク", mvpEnabled: false },
  meeting_room: { areaId: "meeting_room", name: "会議室", mvpEnabled: false },
  research_space: { areaId: "research_space", name: "調査・リサーチスペース", mvpEnabled: true },
  library: { areaId: "library", name: "本棚・資料エリア", mvpEnabled: true },
  terminal_room: { areaId: "terminal_room", name: "ターミナルルーム", mvpEnabled: true },
  qa_room: { areaId: "qa_room", name: "QA・テストルーム", mvpEnabled: true },
  deploy_area: { areaId: "deploy_area", name: "デプロイエリア", mvpEnabled: false },
  server_room: { areaId: "server_room", name: "サーバールーム", mvpEnabled: false },
  break_room: { areaId: "break_room", name: "休憩スペース", mvpEnabled: true },
  github_hub: { areaId: "github_hub", name: "GitHub連携スペース", mvpEnabled: false },
  pm_space: { areaId: "pm_space", name: "プロジェクト管理スペース", mvpEnabled: false },
};

/**
 * MVP maps "本棚・資料エリア" and "調査・リサーチスペース" onto a single visual area
 * per docs/17_MVP_PLAN.md #1; both AreaIds resolve to the same map entry.
 */
export const MVP_AREA_IDS: readonly AreaId[] = [
  "dev_floor",
  "library",
  "research_space",
  "terminal_room",
  "qa_room",
  "break_room",
];
