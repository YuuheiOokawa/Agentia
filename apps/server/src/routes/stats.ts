import type { FastifyInstance } from "fastify";
import { scanAllSessions } from "../persistence/session-history.js";
import { env } from "../config/env.js";

const RANGE_MS: Record<string, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

function dateKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

/** docs/12_API_DESIGN.md #3, docs/08_SCREEN_DESIGN.md #6: usage trend + tool breakdown + test success rate. */
export function registerStatsRoute(fastify: FastifyInstance): void {
  fastify.get<{ Querystring: { range?: string; projectId?: string } }>("/api/stats", async (request, reply) => {
    const range = request.query.range ?? "week";
    const windowMs = RANGE_MS[range] ?? RANGE_MS["week"]!;
    const cutoff = Date.now() - windowMs;

    let sessions = scanAllSessions(env.logDir).filter((s) => Date.parse(s.startedAt) >= cutoff);
    if (request.query.projectId) sessions = sessions.filter((s) => s.projectId === request.query.projectId);

    const dailyMinutes = new Map<string, number>();
    let editCount = 0;
    let readCount = 0;
    let bashCount = 0;
    let testSuccessCount = 0;
    let testFailureCount = 0;
    let subAgentTotal = 0;

    for (const s of sessions) {
      if (s.endedAt) {
        const minutes = (Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60_000;
        const key = dateKey(s.startedAt);
        dailyMinutes.set(key, (dailyMinutes.get(key) ?? 0) + minutes);
      }
      editCount += s.editCount;
      readCount += s.readCount;
      bashCount += s.bashCount;
      testSuccessCount += s.testSuccessCount;
      testFailureCount += s.testFailureCount;
      subAgentTotal += s.subAgentCount;
    }

    const toolTotal = editCount + readCount + bashCount || 1;
    const testTotal = testSuccessCount + testFailureCount;

    return reply.send({
      range,
      sessionCount: sessions.length,
      dailyActiveMinutes: Array.from(dailyMinutes.entries())
        .map(([date, minutes]) => ({ date, minutes: Math.round(minutes) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      toolBreakdown: {
        edit: editCount / toolTotal,
        read: readCount / toolTotal,
        bash: bashCount / toolTotal,
      },
      testSuccessRate: testTotal > 0 ? testSuccessCount / testTotal : null,
      averageSubAgentsPerSession: sessions.length > 0 ? subAgentTotal / sessions.length : 0,
    } satisfies {
      range: string;
      sessionCount: number;
      dailyActiveMinutes: Array<{ date: string; minutes: number }>;
      toolBreakdown: { edit: number; read: number; bash: number };
      testSuccessRate: number | null;
      averageSubAgentsPerSession: number;
    });
  });
}
