/** Server endpoints (docs/14_BACKEND_DESIGN.md #8 env vars, exposed here as NEXT_PUBLIC_*). */
export const SERVER_HTTP_URL = process.env["NEXT_PUBLIC_AGENTIA_SERVER_URL"] ?? "http://127.0.0.1:4317";
export const SERVER_WS_URL = process.env["NEXT_PUBLIC_AGENTIA_WS_URL"] ?? "ws://127.0.0.1:4317/ws";

/** docs/06_REALTIME_COMMUNICATION.md #3: reconnect backoff schedule (ms), capped at the last entry. */
export const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 30000] as const;

/** docs/06_REALTIME_COMMUNICATION.md #6: disconnect if no HEARTBEAT/EVENT received within this window. */
export const HEARTBEAT_TIMEOUT_MS = 30_000;

/** docs/10_OFFICE_SYSTEM.md #4.2: movement queue policy. */
export const MOVEMENT_QUEUE_MAX_LENGTH = 3;
export const EVENT_PRIORITY_ERROR = 100;
export const EVENT_PRIORITY_WAITING = 90;
export const EVENT_PRIORITY_WORK = 50;
export const EVENT_PRIORITY_IDLE = 10;

/** docs/13_FRONTEND_DESIGN.md #2: activity log retention in the client store. */
export const ACTIVITY_LOG_MAX_ENTRIES = 500;

export const DEFAULT_PROJECT_ROOT_STORAGE_KEY = "agentia.projectRoot";

/**
 * Sentinel "project root" meaning "every project, sharing one office" (docs/10_OFFICE_SYSTEM.md
 * company-wide view) rather than one project at a time - mirrors the server's ws/hub.ts
 * COMPANY_CHANNEL constant. Stored/compared as a plain string since projectRoot is user-editable
 * free text everywhere else in the store.
 */
export const COMPANY_VIEW_SENTINEL = "__company__";
