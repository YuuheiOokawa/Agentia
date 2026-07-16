import type { AreaId } from "./office.js";
import type { CharacterState } from "./character.js";

export interface ToolClassification {
  state: CharacterState;
  areaId: AreaId;
}

const READING_TOOLS = new Set(["Read", "Grep", "Glob"]);
const RESEARCH_TOOLS = new Set(["WebSearch", "WebFetch"]);
const CODING_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

/** docs/05_EVENT_DESIGN.md #3 Bash command classification, kept as data so projects can extend it. */
const BASH_TEST_PATTERN = /\b(npm test|npm run test|jest|pytest|vitest|go test|rspec)\b/i;
const BASH_DEPLOY_PATTERN = /\b(docker|deploy|vercel|kubectl|helm)\b/i;
const BASH_GITHUB_PATTERN = /\b(git push|git commit|gh pr|gh repo)\b/i;

function extractBashCommand(toolInput: Record<string, unknown> | null): string {
  if (!toolInput) return "";
  const command = toolInput["command"];
  return typeof command === "string" ? command : "";
}

/**
 * docs/05_EVENT_DESIGN.md #3 tool-name -> state/area mapping table. Shared by the server
 * (docs/14 employee-tracker, for SNAPSHOT) and the frontend (docs/13 applyEvent reducer)
 * so the two never drift apart.
 */
export function classifyTool(toolName: string, toolInput: Record<string, unknown> | null): ToolClassification {
  if (READING_TOOLS.has(toolName)) return { state: "reading", areaId: "library" };
  if (RESEARCH_TOOLS.has(toolName)) return { state: "researching", areaId: "research_space" };
  if (CODING_TOOLS.has(toolName)) return { state: "coding", areaId: "dev_floor" };
  if (toolName === "ExitPlanMode") return { state: "planning", areaId: "meeting_room" };
  if (toolName === "TodoWrite") return { state: "planning", areaId: "pm_space" };
  if (toolName === "Bash") {
    const command = extractBashCommand(toolInput);
    if (BASH_TEST_PATTERN.test(command)) return { state: "testing", areaId: "qa_room" };
    if (BASH_DEPLOY_PATTERN.test(command)) return { state: "deploying", areaId: "deploy_area" };
    if (BASH_GITHUB_PATTERN.test(command)) return { state: "terminal", areaId: "github_hub" };
    return { state: "terminal", areaId: "terminal_room" };
  }
  // Unrecognized/MCP tools: keep the character at their current desk rather than guessing.
  return { state: "coding", areaId: "dev_floor" };
}

export function extractToolTarget(toolName: string, toolInput: Record<string, unknown> | null): string | null {
  if (!toolInput) return null;
  if (toolName === "Bash") {
    const command = extractBashCommand(toolInput);
    return command || null;
  }
  const filePath = toolInput["file_path"] ?? toolInput["path"] ?? toolInput["notebook_path"];
  if (typeof filePath === "string") return filePath;
  const pattern = toolInput["pattern"] ?? toolInput["query"];
  if (typeof pattern === "string") return pattern;
  const url = toolInput["url"];
  if (typeof url === "string") return url;
  return null;
}
