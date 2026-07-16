/** docs/14_BACKEND_DESIGN.md #8 environment variables. */
export const env = {
  port: Number(process.env["AGENTIA_SERVER_PORT"] ?? 4317),
  host: process.env["AGENTIA_ALLOW_REMOTE"] === "true" ? "0.0.0.0" : "127.0.0.1",
  allowRemote: process.env["AGENTIA_ALLOW_REMOTE"] === "true",
  accessToken: process.env["AGENTIA_ACCESS_TOKEN"] ?? null,
  logDir: process.env["AGENTIA_LOG_DIR"] ?? `${process.env["HOME"] ?? "."}/.agentia/logs`,
  dataDir: process.env["AGENTIA_DATA_DIR"] ?? `${process.env["HOME"] ?? "."}/.agentia/data`,
  inactiveAgentTimeoutMs: 90_000,
  offlineDetectionTimeoutMs: 30_000,
  ringBufferMaxEvents: 2000,
  dedupeCacheMaxEntries: 10_000,
  /** Phase 3 (docs/18_ROADMAP.md #3): GitHub webhook signature verification secret. */
  githubWebhookSecret: process.env["AGENTIA_GITHUB_WEBHOOK_SECRET"] ?? null,
} as const;
