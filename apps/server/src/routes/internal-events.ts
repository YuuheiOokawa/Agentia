import type { FastifyInstance } from "fastify";
import { IngestRequestSchema } from "@agentia/shared-types";
import type { SessionManager } from "../core/session-manager.js";

/** docs/12_API_DESIGN.md #2: receives forwarded Claude Code hook payloads from agentia-hook. */
export function registerInternalEventsRoute(fastify: FastifyInstance, sessionManager: SessionManager): void {
  fastify.post("/internal/events", async (request, reply) => {
    const parsed = IngestRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn({ issues: parsed.error.issues }, "rejected malformed hook payload");
      return reply.code(400).send({ error: { code: "INVALID_PAYLOAD", message: "invalid hook payload", details: null } });
    }
    sessionManager.ingest(parsed.data);
    return reply.code(202).send();
  });
}
