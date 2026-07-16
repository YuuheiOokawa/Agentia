"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SessionTable } from "@/components/SessionTable";
import { useProjectStore, currentProjectId } from "@/stores/project-store";
import { fetchProjectSessions, type SessionSummary } from "@/lib/api";

export function HistoryListScreen() {
  // AppShell owns project hydration (shared across every screen).
  const projectRoot = useProjectStore((s) => s.projectRoot);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  const projectId = currentProjectId(projectRoot);

  useEffect(() => {
    if (!projectId) return;
    fetchProjectSessions(projectId)
      .then((res) => setSessions(res.sessions))
      .catch(() => setSessions([]))
      .finally(() => setLoaded(true));
  }, [projectId]);

  return (
    <AppShell>
      <div style={{ padding: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>セッション履歴</h2>
        {!loaded ? <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>読み込み中…</p> : <SessionTable sessions={sessions} />}
      </div>
    </AppShell>
  );
}
