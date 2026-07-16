import { prisma, type Prisma } from "@agentia/db";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { scanAllSessions, scanSession } from "./session-history.js";

async function seedProject(id: string): Promise<void> {
  await prisma.project.create({ data: { id, name: id, rootPath: `/tmp/${id}` } });
}

async function seedEvent(overrides: Partial<Prisma.EventUncheckedCreateInput>): Promise<void> {
  await prisma.event.create({
    data: {
      id: `evt_${Math.random().toString(36).slice(2)}`,
      sessionId: "session_1",
      agentId: "agent_main",
      agentType: "main",
      parentAgentId: null,
      displayName: "Claude (Main)",
      eventType: "tool_use",
      toolName: null,
      status: "running",
      target: null,
      message: "",
      timestamp: new Date("2026-07-16T10:00:00.000Z"),
      seq: 1,
      ...overrides,
    },
  });
}

describe("session-history (Prisma)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.event.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("summarizes edit/read/bash/test counts and subAgentCount for a session", async () => {
    await seedProject("proj_x");
    await prisma.session.create({
      data: { id: "session_1", projectId: "proj_x", startedAt: new Date("2026-07-16T10:00:00.000Z"), endedAt: new Date("2026-07-16T10:05:00.000Z") },
    });
    await seedEvent({ eventType: "tool_result", toolName: "Edit", status: "success", seq: 2 });
    await seedEvent({ eventType: "tool_result", toolName: "Read", status: "success", seq: 3 });
    await seedEvent({ eventType: "tool_result", toolName: "Bash", target: "npm test", status: "success", seq: 4 });
    await seedEvent({ eventType: "tool_error", toolName: "Bash", target: "npm test", status: "error", seq: 5 });
    await seedEvent({ agentId: "agent_sub1", eventType: "agent_spawn", seq: 6 });

    const found = await scanSession("session_1");
    expect(found?.summary.editCount).toBe(1);
    expect(found?.summary.readCount).toBe(1);
    expect(found?.summary.bashCount).toBe(2);
    expect(found?.summary.testCount).toBe(2);
    expect(found?.summary.testSuccessCount).toBe(1);
    expect(found?.summary.testFailureCount).toBe(1);
    expect(found?.summary.subAgentCount).toBe(1);
    expect(found?.summary.endedAt).toBe("2026-07-16T10:05:00.000Z");
  });

  it("scans every session, optionally filtered by project", async () => {
    await seedProject("proj_a");
    await seedProject("proj_b");
    await prisma.session.create({ data: { id: "session_a", projectId: "proj_a", startedAt: new Date() } });
    await prisma.session.create({ data: { id: "session_b", projectId: "proj_b", startedAt: new Date() } });

    expect((await scanAllSessions()).map((s) => s.sessionId).sort()).toEqual(["session_a", "session_b"]);
    expect((await scanAllSessions("proj_a")).map((s) => s.sessionId)).toEqual(["session_a"]);
  });

  it("returns null for an unknown session", async () => {
    expect(await scanSession("does_not_exist")).toBeNull();
  });
});
