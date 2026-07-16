import type { FastifyInstance } from "fastify";
import type { ProjectRegistry } from "../persistence/project-registry.js";
import { scanAllSessions, type SessionSummary } from "../persistence/session-history.js";
import { env } from "../config/env.js";

function aggregate(summaries: SessionSummary[]) {
  const totals = {
    sessionCount: summaries.length,
    editCount: 0,
    readCount: 0,
    bashCount: 0,
    testCount: 0,
    testSuccessCount: 0,
    testFailureCount: 0,
    subAgentCount: 0,
    totalActiveMs: 0,
  };
  for (const s of summaries) {
    totals.editCount += s.editCount;
    totals.readCount += s.readCount;
    totals.bashCount += s.bashCount;
    totals.testCount += s.testCount;
    totals.testSuccessCount += s.testSuccessCount;
    totals.testFailureCount += s.testFailureCount;
    totals.subAgentCount += s.subAgentCount;
    if (s.endedAt) totals.totalActiveMs += Date.parse(s.endedAt) - Date.parse(s.startedAt);
  }
  return totals;
}

/** docs/12_API_DESIGN.md #3: project list/detail, backed by the JSON registry + JSONL scan (no DB yet). */
export function registerProjectRoutes(fastify: FastifyInstance, projectRegistry: ProjectRegistry): void {
  fastify.get("/api/projects", async (_request, reply) => {
    const allSessions = scanAllSessions(env.logDir);
    const projects = projectRegistry.list().map((project) => {
      const sessions = allSessions.filter((s) => s.projectId === project.projectId);
      return { ...project, stats: aggregate(sessions) };
    });
    return reply.send({ projects });
  });

  fastify.get<{ Params: { projectId: string } }>("/api/projects/:projectId", async (request, reply) => {
    const project = projectRegistry.get(request.params.projectId);
    if (!project) {
      return reply.code(404).send({ error: { code: "PROJECT_NOT_FOUND", message: "指定されたプロジェクトが見つかりません", details: null } });
    }
    const sessions = scanAllSessions(env.logDir).filter((s) => s.projectId === project.projectId);
    return reply.send({ ...project, stats: aggregate(sessions) });
  });

  fastify.get<{ Params: { projectId: string } }>("/api/projects/:projectId/sessions", async (request, reply) => {
    const sessions = scanAllSessions(env.logDir).filter((s) => s.projectId === request.params.projectId);
    return reply.send({ sessions });
  });
}
