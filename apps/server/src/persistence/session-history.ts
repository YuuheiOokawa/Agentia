import { prisma, type Event as EventRow, type Session as SessionRow } from "@agentia/db";
import { classifyTool } from "@agentia/shared-types";

export interface SessionSummary {
  sessionId: string;
  projectId: string;
  startedAt: string;
  endedAt: string | null;
  eventCount: number;
  editCount: number;
  readCount: number;
  bashCount: number;
  testCount: number;
  testSuccessCount: number;
  testFailureCount: number;
  subAgentCount: number;
}

const READ_TOOLS = new Set(["Read", "Grep", "Glob"]);
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

function isTestCommand(target: string | null): boolean {
  if (!target) return false;
  return classifyTool("Bash", { command: target }).state === "testing";
}

/** Reduces one session's Postgres event rows into a summary (docs/11_DATABASE_DESIGN.md #1, Phase 3). */
function summarize(session: SessionRow, events: EventRow[]): SessionSummary {
  const summary: SessionSummary = {
    sessionId: session.id,
    projectId: session.projectId,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    eventCount: events.length,
    editCount: 0,
    readCount: 0,
    bashCount: 0,
    testCount: 0,
    testSuccessCount: 0,
    testFailureCount: 0,
    subAgentCount: 0,
  };

  for (const event of events) {
    if (event.eventType === "agent_spawn") summary.subAgentCount += 1;

    if (event.eventType === "tool_result" || event.eventType === "tool_error") {
      const toolName = event.toolName ?? "";
      if (EDIT_TOOLS.has(toolName)) summary.editCount += 1;
      else if (READ_TOOLS.has(toolName)) summary.readCount += 1;
      else if (toolName === "Bash") {
        summary.bashCount += 1;
        if (isTestCommand(event.target)) {
          summary.testCount += 1;
          if (event.eventType === "tool_result") summary.testSuccessCount += 1;
          else summary.testFailureCount += 1;
        }
      }
    }
  }
  return summary;
}

export async function scanAllSessions(projectId?: string): Promise<SessionSummary[]> {
  const sessions = await prisma.session.findMany({
    where: projectId ? { projectId } : undefined,
    include: { events: true },
    orderBy: { startedAt: "desc" },
  });
  return sessions.map((session) => summarize(session, session.events));
}

export async function scanSession(sessionId: string): Promise<{ summary: SessionSummary; events: EventRow[] } | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { events: { orderBy: { seq: "asc" } } },
  });
  if (!session) return null;
  return { summary: summarize(session, session.events), events: session.events };
}
