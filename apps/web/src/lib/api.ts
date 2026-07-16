import { SERVER_HTTP_URL } from "./constants";

export interface ProjectStats {
  sessionCount: number;
  editCount: number;
  readCount: number;
  bashCount: number;
  testCount: number;
  testSuccessCount: number;
  testFailureCount: number;
  subAgentCount: number;
  totalActiveMs: number;
}

export interface ProjectRecord {
  projectId: string;
  rootPath: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
  stats: ProjectStats;
}

export interface SessionSummary {
  sessionId: string;
  projectId: string;
  startedAt: string;
  endedAt: string | null;
  eventCount: number;
  editCount: number;
  readCount: number;
  bashCount: number;
  testCount: number;
  testSuccessCount: number;
  testFailureCount: number;
  subAgentCount: number;
}

export interface StatsResponse {
  range: string;
  sessionCount: number;
  dailyActiveMinutes: Array<{ date: string; minutes: number }>;
  toolBreakdown: { edit: number; read: number; bash: number };
  testSuccessRate: number | null;
  averageSubAgentsPerSession: number;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${SERVER_HTTP_URL}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export function fetchProjects(): Promise<{ projects: ProjectRecord[] }> {
  return getJson("/api/projects");
}

export function fetchProject(projectId: string): Promise<ProjectRecord> {
  return getJson(`/api/projects/${encodeURIComponent(projectId)}`);
}

export function fetchProjectSessions(projectId: string): Promise<{ sessions: SessionSummary[] }> {
  return getJson(`/api/projects/${encodeURIComponent(projectId)}/sessions`);
}

export function fetchSession(sessionId: string): Promise<SessionSummary> {
  return getJson(`/api/sessions/${encodeURIComponent(sessionId)}`);
}

export function fetchSessionEvents(sessionId: string): Promise<{ events: Array<{ eventId: string; timestamp: string; message: string; status: string }> }> {
  return getJson(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
}

export function fetchStats(range: string, projectId?: string): Promise<StatsResponse> {
  const params = new URLSearchParams({ range });
  if (projectId) params.set("projectId", projectId);
  return getJson(`/api/stats?${params.toString()}`);
}
