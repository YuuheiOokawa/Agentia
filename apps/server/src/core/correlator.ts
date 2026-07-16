import type { EmployeeRole, RawHookPayload } from "@agentia/shared-types";

interface AgentRuntimeState {
  agentId: string;
  agentType: EmployeeRole;
  parentAgentId: string | null;
  displayName: string;
  lastEventAt: number;
  recentToolNames: string[];
}

export interface ResolvedAgent {
  agentId: string;
  agentType: EmployeeRole;
  parentAgentId: string | null;
  displayName: string;
  isNewAgent: boolean;
}

/** docs/09_CHARACTER_SYSTEM.md #2.2: agent_type hints from the hook payload, before dynamic re-evaluation. */
const ROLE_HINTS: Record<string, EmployeeRole> = {
  explore: "explore",
  Explore: "explore",
  plan: "plan",
  Plan: "plan",
};

function inferRoleFromToolNames(toolNames: readonly string[]): EmployeeRole {
  const editCount = toolNames.filter((t) => t === "Edit" || t === "Write" || t === "MultiEdit").length;
  const readCount = toolNames.filter((t) => t === "Read" || t === "Grep" || t === "Glob").length;
  const bashCount = toolNames.filter((t) => t === "Bash").length;
  if (editCount > 0 && editCount >= readCount) return "implementation";
  if (readCount > 0) return "explore";
  if (bashCount > 0) return "test";
  return "generic";
}

/** docs/04_CLAUDE_CODE_INTEGRATION.md #4 + docs/09_CHARACTER_SYSTEM.md #2.3: one instance per Claude Code session. */
export class SessionCorrelator {
  private readonly agents = new Map<string, AgentRuntimeState>();
  private agentCounter = 0;

  constructor(private readonly clock: () => number = () => Date.now()) {}

  resolve(payload: RawHookPayload): ResolvedAgent {
    const rawAgentId = payload.agent_id;
    const agentId = rawAgentId ? `agent_${rawAgentId}` : "agent_main";
    const parentAgentId = rawAgentId ? "agent_main" : null;

    const existing = this.agents.get(agentId);
    if (existing) {
      this.trackTool(existing, payload.tool_name);
      existing.lastEventAt = this.clock();
      return { agentId, agentType: existing.agentType, parentAgentId, displayName: existing.displayName, isNewAgent: false };
    }

    let agentType: EmployeeRole;
    let displayName: string;
    if (!rawAgentId) {
      agentType = "main";
      displayName = "Claude (Main)";
    } else {
      this.agentCounter += 1;
      agentType = payload.agent_type ? ROLE_HINTS[payload.agent_type] ?? "generic" : "generic";
      displayName = `${payload.agent_type ?? "Agent"} #${this.agentCounter}`;
    }

    const state: AgentRuntimeState = {
      agentId,
      agentType,
      parentAgentId,
      displayName,
      lastEventAt: this.clock(),
      recentToolNames: [],
    };
    this.agents.set(agentId, state);
    this.trackTool(state, payload.tool_name);
    return { agentId, agentType: state.agentType, parentAgentId, displayName, isNewAgent: true };
  }

  private trackTool(state: AgentRuntimeState, toolName: string | undefined) {
    if (!toolName) return;
    state.recentToolNames.push(toolName);
    if (state.recentToolNames.length > 5) state.recentToolNames.shift();
    if (state.agentType !== "main") {
      state.agentType = inferRoleFromToolNames(state.recentToolNames);
    }
  }

  /** docs/09_CHARACTER_SYSTEM.md #2.3: Sub Agents "退勤" after `timeoutMs` of silence if SubagentStop never arrives. */
  sweepInactive(timeoutMs: number): ResolvedAgent[] {
    const stopped: ResolvedAgent[] = [];
    const nowMs = this.clock();
    for (const [agentId, state] of this.agents) {
      if (agentId === "agent_main") continue;
      if (nowMs - state.lastEventAt > timeoutMs) {
        stopped.push({
          agentId,
          agentType: state.agentType,
          parentAgentId: state.parentAgentId,
          displayName: state.displayName,
          isNewAgent: false,
        });
        this.agents.delete(agentId);
      }
    }
    return stopped;
  }

  markStopped(agentId: string): void {
    this.agents.delete(agentId);
  }
}
