import { describe, expect, it } from "vitest";
import { classifyTool, extractToolTarget } from "./tool-classification.js";

describe("classifyTool", () => {
  it("routes Read/Grep/Glob to the library", () => {
    expect(classifyTool("Read", null)).toEqual({ state: "reading", areaId: "library" });
    expect(classifyTool("Grep", null)).toEqual({ state: "reading", areaId: "library" });
  });

  it("routes Edit/Write to the dev floor", () => {
    expect(classifyTool("Edit", null)).toEqual({ state: "coding", areaId: "dev_floor" });
  });

  it("routes WebSearch to the research space", () => {
    expect(classifyTool("WebSearch", null)).toEqual({ state: "researching", areaId: "research_space" });
  });

  it("routes a plain Bash command to the terminal room", () => {
    expect(classifyTool("Bash", { command: "ls -la" })).toEqual({ state: "terminal", areaId: "terminal_room" });
  });

  it("routes test-shaped Bash commands to the QA room", () => {
    expect(classifyTool("Bash", { command: "npm test" })).toEqual({ state: "testing", areaId: "qa_room" });
    expect(classifyTool("Bash", { command: "pytest -k foo" })).toEqual({ state: "testing", areaId: "qa_room" });
  });

  it("routes deploy-shaped Bash commands to the deploy area", () => {
    expect(classifyTool("Bash", { command: "kubectl apply -f deploy.yaml" })).toEqual({
      state: "deploying",
      areaId: "deploy_area",
    });
  });

  it("routes git push/commit to the GitHub hub", () => {
    expect(classifyTool("Bash", { command: "git push origin main" })).toEqual({
      state: "terminal",
      areaId: "github_hub",
    });
  });
});

describe("extractToolTarget", () => {
  it("extracts a Bash command", () => {
    expect(extractToolTarget("Bash", { command: "npm test" })).toBe("npm test");
  });

  it("extracts a file_path for Edit", () => {
    expect(extractToolTarget("Edit", { file_path: "src/index.ts" })).toBe("src/index.ts");
  });

  it("returns null when there is nothing to extract", () => {
    expect(extractToolTarget("Read", null)).toBeNull();
  });
});
