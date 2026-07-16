import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectRegistry } from "./project-registry.js";

describe("ProjectRegistry", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "agentia-registry-test-"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("registers a new project on first sight and reuses it afterwards", () => {
    const registry = new ProjectRegistry(dataDir);
    const first = registry.resolveByRoot("/home/user/my-app");
    expect(first.projectId).toBe("proj_my-app");

    const second = registry.resolveByRoot("/home/user/my-app");
    expect(second.projectId).toBe(first.projectId);
    expect(registry.list()).toHaveLength(1);
  });

  it("disambiguates two different roots that share a basename", () => {
    const registry = new ProjectRegistry(dataDir);
    const a = registry.resolveByRoot("/home/user/a/app");
    const b = registry.resolveByRoot("/home/user/b/app");
    expect(a.projectId).not.toBe(b.projectId);
  });

  it("persists registrations across instances (survives a server restart)", () => {
    const first = new ProjectRegistry(dataDir);
    first.resolveByRoot("/home/user/my-app");

    const reloaded = new ProjectRegistry(dataDir);
    expect(reloaded.list()).toHaveLength(1);
    expect(reloaded.list()[0]?.rootPath).toBe("/home/user/my-app");
  });
});
