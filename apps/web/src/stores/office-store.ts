import { create } from "zustand";
import type { AreaId, CharacterState, Employee, InternalEvent } from "@agentia/shared-types";
import { ACTIVITY_LOG_MAX_ENTRIES } from "@/lib/constants";
import { applyEvent, drainAllQueues } from "@/features/office/movement/apply-event";
import { drainQueue } from "@/features/office/movement/movement-queue";

export type ConnectionState = "connected" | "reconnecting" | "offline";

export interface ActivityLogEntry {
  eventId: string;
  seq: number;
  timestamp: string;
  message: string;
  agentDisplayName: string;
  status: InternalEvent["status"];
}

interface OfficeStoreState {
  employees: Record<string, Employee>;
  activityLog: ActivityLogEntry[];
  connectionState: ConnectionState;
  claudeCodeOffline: boolean;
  lastSeq: number;

  applyIncomingEvent: (event: InternalEvent) => void;
  hydrateSnapshot: (employees: Employee[]) => void;
  setConnectionState: (state: ConnectionState) => void;
  tickMovementQueues: () => void;
}

/** docs/13_FRONTEND_DESIGN.md #2: the OfficeStore is the discrete source of truth (state + destination), not pixel coordinates. */
export const useOfficeStore = create<OfficeStoreState>((set, get) => ({
  employees: {},
  activityLog: [],
  connectionState: "reconnecting",
  claudeCodeOffline: false,
  lastSeq: 0,

  applyIncomingEvent: (event) => {
    const employees = applyEvent(get().employees, event);
    const displayName = employees[event.agentId]?.displayName ?? event.agentId;
    const logEntry: ActivityLogEntry = {
      eventId: event.eventId,
      seq: event.seq,
      timestamp: event.timestamp,
      message: event.message,
      agentDisplayName: displayName,
      status: event.status,
    };
    const activityLog = [logEntry, ...get().activityLog].slice(0, ACTIVITY_LOG_MAX_ENTRIES);
    set({
      employees,
      activityLog,
      lastSeq: Math.max(get().lastSeq, event.seq),
      claudeCodeOffline: event.eventType === "claude_code_offline",
    });
  },

  hydrateSnapshot: (employeeList) => {
    const employees: Record<string, Employee> = {};
    for (const employee of employeeList) employees[employee.agentId] = employee;
    set({ employees });
  },

  setConnectionState: (connectionState) => set({ connectionState }),

  tickMovementQueues: () => {
    const employees = drainAllQueues(get().employees, (slice) => {
      const resolvedState: CharacterState = slice.movementQueue[0]
        ? classifyForResolvedState(slice.movementQueue[0].destinationAreaId)
        : slice.state;
      return drainQueue(slice, resolvedState);
    });
    set({ employees });
  },
}));

/** When a queued step is dequeued we don't have its original tool-derived state anymore, so re-derive a reasonable one from the area. */
function classifyForResolvedState(areaId: AreaId): CharacterState {
  switch (areaId) {
    case "library":
      return "reading";
    case "research_space":
      return "researching";
    case "dev_floor":
      return "coding";
    case "terminal_room":
      return "terminal";
    case "qa_room":
      return "testing";
    case "deploy_area":
      return "deploying";
    case "meeting_room":
    case "pm_space":
      return "planning";
    case "github_hub":
      return "terminal";
    case "break_room":
      return "completed";
    case "personal_desk":
    case "server_room":
    default:
      return "idle";
  }
}
