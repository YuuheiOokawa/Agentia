import { z } from "zod";

/** docs/05_EVENT_DESIGN.md #2 event type list (MVP subset marked below is the minimum the server must emit). */
export const EVENT_TYPES = [
  "session_start",
  "session_end",
  "user_prompt_submit",
  "tool_use",
  "tool_result",
  "tool_error",
  "agent_spawn",
  "agent_stop",
  "waiting_input",
  "turn_complete",
  "context_compact",
  "claude_code_offline",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = ["running", "success", "error", "waiting", "info"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_SOURCES = ["claude_code", "github"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

/** docs/09_CHARACTER_SYSTEM.md #2.2 role table. */
export const EMPLOYEE_ROLES = [
  "main",
  "explore",
  "plan",
  "implementation",
  "test",
  "devops",
  "github",
  "generic",
] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const EventSchema = z.object({
  eventSchemaVersion: z.literal("1.0").default("1.0"),
  eventId: z.string(),
  eventSource: z.enum(EVENT_SOURCES),
  projectId: z.string(),
  sessionId: z.string(),
  agentId: z.string(),
  agentType: z.enum(EMPLOYEE_ROLES),
  parentAgentId: z.string().nullable(),
  eventType: z.enum(EVENT_TYPES),
  toolName: z.string().nullable(),
  status: z.enum(EVENT_STATUSES),
  target: z.string().nullable(),
  message: z.string(),
  timestamp: z.string(),
  seq: z.number().int().nonnegative(),
});
export type InternalEvent = z.infer<typeof EventSchema>;

/**
 * Common fields present on every Claude Code hook payload
 * (docs/04_CLAUDE_CODE_INTEGRATION.md #4). No timestamp field exists upstream.
 */
export const RawHookPayloadSchema = z
  .object({
    session_id: z.string(),
    transcript_path: z.string().optional(),
    cwd: z.string(),
    hook_event_name: z.string(),
    permission_mode: z.string().optional(),
    tool_name: z.string().optional(),
    tool_input: z.record(z.string(), z.unknown()).optional(),
    tool_output: z.string().optional(),
    user_input: z.string().optional(),
    notification_type: z.string().optional(),
    message: z.string().optional(),
    agent_id: z.string().optional(),
    agent_type: z.string().optional(),
  })
  .passthrough();
export type RawHookPayload = z.infer<typeof RawHookPayloadSchema>;

/** What the hook-forwarder CLI actually POSTs to the ingest API. */
export const IngestRequestSchema = z.object({
  clientEventId: z.string().uuid(),
  hookEventName: z.string(),
  payload: RawHookPayloadSchema,
});
export type IngestRequest = z.infer<typeof IngestRequestSchema>;
