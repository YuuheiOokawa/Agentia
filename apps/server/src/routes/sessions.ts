import type { FastifyInstance } from "fastify";
import { scanSession } from "../persistence/session-history.js";
import { env } from "../config/env.js";

/** docs/12_API_DESIGN.md #3: session detail + event log, read from the per-session JSONL file. */
export function registerSessionRoutes(fastify: FastifyInstance): void {
  fastify.get<{ Params: { sessionId: string } }>("/api/sessions/:sessionId", async (request, reply) => {
    const found = scanSession(env.logDir, request.params.sessionId);
    if (!found) {
      return reply.code(404).send({ error: { code: "SESSION_NOT_FOUND", message: "指定されたセッションが見つかりません", details: null } });
    }
    return reply.send(found.summary);
  });

  fastify.get<{ Params: { sessionId: string }; Querystring: { afterSeq?: string } }>(
    "/api/sessions/:sessionId/events",
    async (request, reply) => {
      const found = scanSession(env.logDir, request.params.sessionId);
      if (!found) {
        return reply.code(404).send({ error: { code: "SESSION_NOT_FOUND", message: "指定されたセッションが見つかりません", details: null } });
      }
      const afterSeq = Number(request.query.afterSeq ?? "0");
      const events = found.events.filter((e) => e.seq > afterSeq);
      return reply.send({ events });
    }
  );
}
