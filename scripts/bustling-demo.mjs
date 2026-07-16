// Simulates a busy Claude Code session (a main agent plus several concurrent sub agents)
// against a running Agentia server, so you can preview office liveliness without waiting
// for a real long-running Claude Code session. Usage: node scripts/bustling-demo.mjs [seconds]
import { randomUUID } from "node:crypto";

const SERVER_URL = process.env.AGENTIA_INGEST_URL ?? "http://127.0.0.1:4317/internal/events";
const CWD = process.cwd();
const SESSION_ID = `session_demo_${Date.now()}`;
const DURATION_MS = (Number(process.argv[2]) || 60) * 1000;

const TOOL_POOL = [
  { tool_name: "Read", tool_input: () => ({ file_path: pick(["src/UserService.ts", "src/authService.ts", "src/index.ts"]) }) },
  { tool_name: "Grep", tool_input: () => ({ pattern: pick(["TODO", "authToken", "export function"]) }) },
  { tool_name: "Edit", tool_input: () => ({ file_path: pick(["src/UserService.ts", "src/routes.ts"]) }) },
  { tool_name: "WebSearch", tool_input: () => ({ query: pick(["pixi.js performance", "fastify websocket", "zod schema"]) }) },
  { tool_name: "Bash", tool_input: () => ({ command: pick(["npm test", "npm run lint", "npm run build"]) }) },
  { tool_name: "Bash", tool_input: () => ({ command: pick(["git commit -m wip", "git push origin main"]) }) },
  { tool_name: "Bash", tool_input: () => ({ command: pick(["docker build .", "kubectl apply -f deploy.yaml"]) }) },
];
const AGENT_TYPES = ["Explore", "Plan", "general-purpose"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randDelay(min, max) {
  return min + Math.random() * (max - min);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function post(hookEventName, payload) {
  try {
    await fetch(SERVER_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientEventId: randomUUID(), hookEventName, payload: { session_id: SESSION_ID, cwd: CWD, hook_event_name: hookEventName, ...payload } }),
    });
  } catch (err) {
    console.error(`[demo] failed to post ${hookEventName}:`, err.message);
  }
}

async function workLoop(agentId, label, until) {
  while (Date.now() < until) {
    const tool = pick(TOOL_POOL);
    const toolInput = tool.tool_input();
    const agentFields = agentId ? { agent_id: agentId } : {};
    await post("PreToolUse", { ...agentFields, tool_name: tool.tool_name, tool_input: toolInput });
    await sleep(randDelay(500, 1800));
    const failed = Math.random() < 0.12;
    await post(failed ? "PostToolUseFailure" : "PostToolUse", {
      ...agentFields,
      tool_name: tool.tool_name,
      tool_input: toolInput,
      tool_output: failed ? "error: something went wrong" : "ok",
    });
    console.log(`[demo] ${label} ${tool.tool_name}${failed ? " (failed)" : ""}`);
    await sleep(randDelay(400, 2200));
  }
}

async function subAgentLifecycle(index, until) {
  while (Date.now() < until) {
    const agentId = `sub${index}-${randomUUID().slice(0, 6)}`;
    const agentType = pick(AGENT_TYPES);
    await post("SubagentStart", { agent_id: agentId, agent_type: agentType });
    console.log(`[demo] spawn ${agentType} (${agentId})`);
    const activeFor = Math.min(until - Date.now(), randDelay(4000, 12000));
    await workLoop(agentId, `${agentType}#${index}`, Date.now() + activeFor);
    await post("SubagentStop", { agent_id: agentId });
    console.log(`[demo] stop ${agentId}`);
    await sleep(randDelay(500, 3000));
  }
}

async function main() {
  const until = Date.now() + DURATION_MS;
  console.log(`[demo] session=${SESSION_ID} cwd=${CWD} duration=${DURATION_MS / 1000}s`);
  await post("SessionStart", {});

  const SUB_AGENT_COUNT = 4;
  await Promise.all([
    workLoop(null, "Main", until),
    ...Array.from({ length: SUB_AGENT_COUNT }, (_, i) => subAgentLifecycle(i + 1, until)),
  ]);

  await post("Stop", {});
  console.log("[demo] done");
}

main();
