import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { env } from "./config/env.js";
import { SessionManager } from "./core/session-manager.js";
import { ProjectRegistry, ensureDataDir } from "./persistence/project-registry.js";
import { registerInternalEventsRoute } from "./routes/internal-events.js";
import { registerConnectionRoutes } from "./routes/connection.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerStatsRoute } from "./routes/stats.js";
import { registerWebSocketHub } from "./ws/hub.js";

async function start(): Promise<void> {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);

  ensureDataDir(env.dataDir);
  const projectRegistry = new ProjectRegistry();
  await projectRegistry.init();

  const sessionManager = new SessionManager(
    {
      logDir: env.logDir,
      ringBufferMaxEvents: env.ringBufferMaxEvents,
      dedupeCacheMaxEntries: env.dedupeCacheMaxEntries,
      inactiveAgentTimeoutMs: env.inactiveAgentTimeoutMs,
      offlineDetectionTimeoutMs: env.offlineDetectionTimeoutMs,
    },
    projectRegistry
  );
  sessionManager.start();

  registerInternalEventsRoute(fastify, sessionManager);
  registerConnectionRoutes(fastify, sessionManager, projectRegistry);
  registerProjectRoutes(fastify, projectRegistry);
  registerSessionRoutes(fastify);
  registerStatsRoute(fastify);
  registerWebSocketHub(fastify, sessionManager);

  fastify.get("/healthz", async () => ({ ok: true }));

  await fastify.listen({ port: env.port, host: env.host });
}

start().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("failed to start agentia server", error);
  process.exit(1);
});
