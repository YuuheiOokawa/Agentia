import type { FastifyInstance } from "fastify";
import { prisma } from "@agentia/db";
import type { ProjectRegistry } from "../persistence/project-registry.js";
import { scanAllSessions, type SessionSummary } from "../persistence/session-history.js";

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
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };
  for (const s of summaries) {
    totals.editCount += s.editCount;
    totals.readCount += s.readCount;
    totals.bashCount += s.bashCount;
    totals.testCount += s.testCount;
    totals.testSuccessCount += s.testSuccessCount;
    totals.testFailureCount += s.testFailureCount;
    totals.subAgentCount += s.subAgentCount;
    totals.inputTokens += s.inputTokens;
    totals.outputTokens += s.outputTokens;
    totals.costUsd += s.costUsd;
    if (s.endedAt) totals.totalActiveMs += Date.parse(s.endedAt) - Date.parse(s.startedAt);
  }
  return totals;
}

/** docs/12_API_DESIGN.md #3: project list/detail, backed by the Postgres-backed registry + session history (Phase 3). */
export function registerProjectRoutes(fastify: FastifyInstance, projectRegistry: ProjectRegistry): void {
  fastify.get("/api/projects", async (_request, reply) => {
    const allSessions = await scanAllSessions();
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
    const sessions = await scanAllSessions(project.projectId);
    return reply.send({ ...project, stats: aggregate(sessions) });
  });

  fastify.get<{ Params: { projectId: string } }>("/api/projects/:projectId/sessions", async (request, reply) => {
    const sessions = await scanAllSessions(request.params.projectId);
    return reply.send({ sessions });
  });

  fastify.put<{ Params: { projectId: string }; Body: { githubRepo: string | null } }>(
    "/api/projects/:projectId/github-repo",
    async (request, reply) => {
      const updated = await projectRegistry.setGithubRepo(request.params.projectId, request.body.githubRepo);
      if (!updated) {
        return reply.code(404).send({ error: { code: "PROJECT_NOT_FOUND", message: "指定されたプロジェクトが見つかりません", details: null } });
      }
      return reply.send(updated);
    }
  );

  /** docs/10_OFFICE_SYSTEM.md github_hub, docs/18_ROADMAP.md #3: recent GitHub activity panel. */
  fastify.get<{ Params: { projectId: string } }>("/api/projects/:projectId/github-events", async (request, reply) => {
    const project = projectRegistry.get(request.params.projectId);
    if (!project) {
      return reply.code(404).send({ error: { code: "PROJECT_NOT_FOUND", message: "指定されたプロジェクトが見つかりません", details: null } });
    }
    const events = await prisma.githubEvent.findMany({
      where: { projectId: project.projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return reply.send({ events });
  });
}
