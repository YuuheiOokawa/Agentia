import { prisma } from "@agentia/db";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ProjectRegistry } from "./project-registry.js";

describe("ProjectRegistry", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.event.deleteMany();
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registers a new project on first sight and reuses it afterwards", async () => {
    const registry = new ProjectRegistry();
    await registry.init();
    const first = registry.resolveByRoot("/home/user/my-app");
    expect(first.projectId).toBe("proj_my-app");

    const second = registry.resolveByRoot("/home/user/my-app");
    expect(second.projectId).toBe(first.projectId);
    expect(registry.list()).toHaveLength(1);
    await registry.flush();
  });

  it("disambiguates two different roots that share a basename", async () => {
    const registry = new ProjectRegistry();
    await registry.init();
    const a = registry.resolveByRoot("/home/user/a/app");
    const b = registry.resolveByRoot("/home/user/b/app");
    expect(a.projectId).not.toBe(b.projectId);
    await registry.flush();
  });

  it("persists registrations across instances (survives a server restart)", async () => {
    const first = new ProjectRegistry();
    await first.init();
    first.resolveByRoot("/home/user/my-app");
    await first.flush();

    const reloaded = new ProjectRegistry();
    await reloaded.init();
    expect(reloaded.list()).toHaveLength(1);
    expect(reloaded.list()[0]?.rootPath).toBe("/home/user/my-app");
  });

  it("links and looks up a GitHub repo", async () => {
    const registry = new ProjectRegistry();
    await registry.init();
    const project = registry.resolveByRoot("/home/user/my-app");
    await registry.setGithubRepo(project.projectId, "acme/my-app");
    expect(registry.findByGithubRepo("acme/my-app")?.projectId).toBe(project.projectId);
    await registry.flush();
  });
});
