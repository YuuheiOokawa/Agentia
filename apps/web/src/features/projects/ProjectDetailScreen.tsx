"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatTile } from "@/components/StatTile";
import { SessionTable } from "@/components/SessionTable";
import { useProjectStore } from "@/stores/project-store";
import { fetchProject, fetchProjectSessions, type ProjectRecord, type SessionSummary } from "@/lib/api";
import { formatDuration } from "@/lib/format";

export function ProjectDetailScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const setProjectRoot = useProjectStore((s) => s.setProjectRoot);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchProject(projectId)
      .then(setProject)
      .catch(() => setNotFound(true));
    fetchProjectSessions(projectId)
      .then((res) => setSessions(res.sessions))
      .catch(() => setSessions([]));
  }, [projectId]);

  function openOffice() {
    if (!project) return;
    setProjectRoot(project.rootPath);
    router.push("/office");
  }

  return (
    <AppShell>
      <div style={{ padding: "1.5rem" }}>
        <Link href="/projects" style={{ fontSize: "0.85rem", color: "var(--accent)" }}>
          ← プロジェクト一覧へ
        </Link>

        {notFound && <p>プロジェクトが見つかりませんでした。</p>}

        {project && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0.5rem 0 1rem" }}>
              <h2 style={{ margin: 0 }}>📁 {project.name}</h2>
              <button onClick={openOffice}>オフィスを開く →</button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>path: {project.rootPath}</p>

            <h3 style={{ fontSize: "0.9rem" }}>累計統計</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <StatTile label="総利用時間" value={formatDuration(project.stats.totalActiveMs)} />
              <StatTile label="セッション数" value={project.stats.sessionCount} />
              <StatTile label="編集ファイル" value={project.stats.editCount} />
              <StatTile label="Sub Agent数" value={project.stats.subAgentCount} />
            </div>

            <h3 style={{ fontSize: "0.9rem" }}>セッション履歴</h3>
            <SessionTable sessions={sessions} />
          </>
        )}
      </div>
    </AppShell>
  );
}
