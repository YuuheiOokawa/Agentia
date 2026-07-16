/**
 * docs/11_DATABASE_DESIGN.md #7: one-time backfill from the MVP/Phase2 JSONL logs +
 * projects.json into the Phase3 Postgres schema, so upgrading doesn't lose local history.
 *
 * Usage: npx tsx scripts/import-jsonl.ts [logDir] [dataDir]
 *   logDir  defaults to $AGENTIA_LOG_DIR or ~/.agentia/logs  (one <sessionId>.jsonl per session)
 *   dataDir defaults to $AGENTIA_DATA_DIR or ~/.agentia/data (projects.json)
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@agentia/db";
import { EventSchema, type InternalEvent } from "@agentia/shared-types";

interface LegacyProjectRecord {
  projectId: string;
  rootPath: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
}

async function loadLegacyProjects(dataDir: string): Promise<Map<string, LegacyProjectRecord>> {
  try {
    const raw = await readFile(join(dataDir, "projects.json"), "utf8");
    const parsed = JSON.parse(raw) as LegacyProjectRecord[];
    return new Map(parsed.map((p) => [p.projectId, p]));
  } catch {
    return new Map();
  }
}

async function loadSessionEvents(logDir: string, fileName: string): Promise<InternalEvent[]> {
  const raw = await readFile(join(logDir, fileName), "utf8");
  const events: InternalEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const parsed = EventSchema.safeParse(JSON.parse(line));
    if (parsed.success) events.push(parsed.data);
    else console.warn(`  skipping malformed line in ${fileName}: ${parsed.error.message}`);
  }
  events.sort((a, b) => a.seq - b.seq);
  return events;
}

async function importProject(projectId: string, legacy: LegacyProjectRecord | undefined): Promise<void> {
  const rootPath = legacy?.rootPath ?? projectId;
  const name = legacy?.name ?? projectId;
  await prisma.project.upsert({
    where: { id: projectId },
    create: {
      id: projectId,
      rootPath,
      name,
      createdAt: legacy ? new Date(legacy.createdAt) : new Date(),
      lastSeenAt: legacy ? new Date(legacy.lastSeenAt) : new Date(),
    },
    update: {},
  });
}

async function importSession(events: InternalEvent[]): Promise<{ eventCount: number; agentCount: number }> {
  const first = events[0];
  if (!first) return { eventCount: 0, agentCount: 0 };

  const sessionEnd = events.find((e) => e.eventType === "session_end");
  const last = events[events.length - 1]!;

  await prisma.session.upsert({
    where: { id: first.sessionId },
    create: {
      id: first.sessionId,
      projectId: first.projectId,
      startedAt: new Date(first.timestamp),
      endedAt: sessionEnd ? new Date(sessionEnd.timestamp) : null,
    },
    update: {
      endedAt: sessionEnd ? new Date(sessionEnd.timestamp) : undefined,
    },
  });

  const agents = new Map<string, { agentType: string; displayName: string; parentAgentId: string | null; spawnedAt: string; completedAt: string | null }>();
  for (const event of events) {
    if (event.eventType === "agent_spawn" && !agents.has(event.agentId)) {
      agents.set(event.agentId, {
        agentType: event.agentType,
        displayName: event.displayName,
        parentAgentId: event.parentAgentId,
        spawnedAt: event.timestamp,
        completedAt: null,
      });
    }
    if (event.eventType === "agent_stop") {
      const agent = agents.get(event.agentId);
      if (agent) agent.completedAt = event.timestamp;
    }
  }
  // main agent is implicit (never gets an explicit agent_spawn event) - synthesize it from the first event.
  if (!agents.has(first.agentId)) {
    agents.set(first.agentId, {
      agentType: first.agentType,
      displayName: first.displayName,
      parentAgentId: null,
      spawnedAt: first.timestamp,
      completedAt: sessionEnd ? sessionEnd.timestamp : null,
    });
  }

  for (const [internalId, agent] of agents) {
    await prisma.agent.upsert({
      where: { sessionId_internalId: { sessionId: first.sessionId, internalId } },
      create: {
        sessionId: first.sessionId,
        internalId,
        parentAgentId: agent.parentAgentId,
        agentType: agent.agentType,
        displayName: agent.displayName,
        spawnedAt: new Date(agent.spawnedAt),
        completedAt: agent.completedAt ? new Date(agent.completedAt) : null,
      },
      update: {
        completedAt: agent.completedAt ? new Date(agent.completedAt) : undefined,
      },
    });
  }

  for (const event of events) {
    await prisma.event.upsert({
      where: { id: event.eventId },
      create: {
        id: event.eventId,
        sessionId: event.sessionId,
        agentId: event.agentId,
        agentType: event.agentType,
        parentAgentId: event.parentAgentId,
        displayName: event.displayName,
        eventType: event.eventType,
        toolName: event.toolName,
        status: event.status,
        target: event.target,
        message: event.message,
        timestamp: new Date(event.timestamp),
        seq: event.seq,
      },
      update: {},
    });
  }

  void last; // last event's timestamp is only used implicitly via sessionEnd/session bounds above
  return { eventCount: events.length, agentCount: agents.size };
}

async function main(): Promise<void> {
  const logDir = process.argv[2] ?? process.env["AGENTIA_LOG_DIR"] ?? `${process.env["HOME"] ?? "."}/.agentia/logs`;
  const dataDir = process.argv[3] ?? process.env["AGENTIA_DATA_DIR"] ?? `${process.env["HOME"] ?? "."}/.agentia/data`;

  console.log(`Importing JSONL logs from ${logDir} (projects.json from ${dataDir}) into Postgres...`);

  const legacyProjects = await loadLegacyProjects(dataDir);

  let files: string[];
  try {
    files = (await readdir(logDir)).filter((f) => f.endsWith(".jsonl"));
  } catch {
    console.log("No log directory found - nothing to import.");
    return;
  }

  if (files.length === 0) {
    console.log("No .jsonl session files found - nothing to import.");
    return;
  }

  const importedProjects = new Set<string>();
  let totalEvents = 0;
  let totalAgents = 0;
  let totalSessions = 0;

  for (const file of files) {
    const events = await loadSessionEvents(logDir, file);
    if (events.length === 0) {
      console.warn(`  ${file}: no valid events, skipping`);
      continue;
    }
    const projectId = events[0]!.projectId;
    if (!importedProjects.has(projectId)) {
      await importProject(projectId, legacyProjects.get(projectId));
      importedProjects.add(projectId);
    }
    const { eventCount, agentCount } = await importSession(events);
    totalSessions += 1;
    totalEvents += eventCount;
    totalAgents += agentCount;
    console.log(`  ${file}: imported ${eventCount} events, ${agentCount} agents`);
  }

  console.log(
    `Done: ${importedProjects.size} project(s), ${totalSessions} session(s), ${totalAgents} agent(s), ${totalEvents} event(s).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
