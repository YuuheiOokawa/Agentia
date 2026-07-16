import { z } from "zod";
import { EMPLOYEE_ROLES } from "./event.js";
import { AREA_IDS } from "./office.js";

/** docs/09_CHARACTER_SYSTEM.md #3 state list. */
export const CHARACTER_STATES = [
  "idle",
  "moving",
  "researching",
  "reading",
  "planning",
  "coding",
  "terminal",
  "testing",
  "deploying",
  "waiting",
  "error",
  "completed",
] as const;
export type CharacterState = (typeof CHARACTER_STATES)[number];

export const MovementStepSchema = z.object({
  destinationAreaId: z.enum(AREA_IDS),
  eventId: z.string(),
  priority: z.number().int(),
});
export type MovementStep = z.infer<typeof MovementStepSchema>;

export const EmployeeSchema = z.object({
  agentId: z.string(),
  sessionId: z.string(),
  parentAgentId: z.string().nullable(),
  role: z.enum(EMPLOYEE_ROLES),
  displayName: z.string(),
  avatarVariant: z.number().int().min(0).max(7),
  state: z.enum(CHARACTER_STATES),
  areaId: z.enum(AREA_IDS),
  destinationAreaId: z.enum(AREA_IDS).nullable(),
  currentTask: z.string().nullable(),
  currentTool: z.string().nullable(),
  spawnedAt: z.string(),
  completedAt: z.string().nullable(),
  hasWarning: z.boolean(),
  movementQueue: z.array(MovementStepSchema),
});
export type Employee = z.infer<typeof EmployeeSchema>;

/** docs/09_CHARACTER_SYSTEM.md #3.2 priority rule, used by the movement queue (docs/10_OFFICE_SYSTEM.md #4.2). */
export const EVENT_PRIORITY = {
  error: 100,
  waiting: 90,
  work: 50,
  idle: 10,
} as const;
