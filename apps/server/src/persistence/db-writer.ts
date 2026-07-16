import { prisma } from "@agentia/db";
import type { InternalEvent } from "@agentia/shared-types";

function swallow<T>(promise: Promise<T>): Promise<void> {
  return promise.then(
    () => undefined,
    () => undefined // docs/14_BACKEND_DESIGN.md #6: DB failures degrade gracefully, never crash ingestion.
  );
}

/** Must resolve before any Event/Agent row for this session is written (FK: they reference Session.id). */
export function upsertSession(sessionId: string, projectId: string, startedAt: Date): Promise<void> {
  return swallow(
    prisma.session.upsert({
      where: { id: sessionId },
      create: { id: sessionId, projectId, startedAt },
      update: {},
    })
  );
}

export function markSessionEnded(sessionId: string, endedAt: Date): Promise<void> {
  return swallow(prisma.session.update({ where: { id: sessionId }, data: { endedAt } }));
}

export function persistAgentSpawned(params: {
  sessionId: string;
  internalId: string;
  parentAgentId: string | null;
  agentType: string;
  displayName: string;
  spawnedAt: Date;
}): Promise<void> {
  return swallow(
    prisma.agent.create({
      data: {
        sessionId: params.sessionId,
        internalId: params.internalId,
        parentAgentId: params.parentAgentId,
        agentType: params.agentType,
        displayName: params.displayName,
        spawnedAt: params.spawnedAt,
      },
    })
  );
}

export function persistAgentCompleted(sessionId: string, internalId: string, completedAt: Date): Promise<void> {
  return swallow(
    prisma.agent.updateMany({
      where: { sessionId, internalId },
      data: { completedAt },
    })
  );
}

export function persistEvent(event: InternalEvent): Promise<void> {
  return swallow(
    prisma.event.create({
      data: {
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
    })
  );
}
