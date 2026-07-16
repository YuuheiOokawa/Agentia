"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatTile } from "@/components/StatTile";
import { SessionTable } from "@/components/SessionTable";
import { useProjectStore } from "@/stores/project-store";
import {
  fetchProject,
  fetchProjectGithubEvents,
  fetchProjectSessions,
  setProjectGithubRepo,
  type GithubEventRecord,
  type ProjectRecord,
  type SessionSummary,
} from "@/lib/api";
import { formatCost, formatDateTime, formatDuration, formatTokens } from "@/lib/format";

const GITHUB_EVENT_ICON: Record<string, string> = {
  push: "📦",
  pull_request: "🔀",
  issues: "📝",
  pull_request_review: "👀",
};

export function ProjectDetailScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const setProjectRoot = useProjectStore((s) => s.setProjectRoot);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [githubEvents, setGithubEvents] = useState<GithubEventRecord[]>([]);
  const [githubRepoInput, setGithubRepoInput] = useState("");
  const [savingGithubRepo, setSavingGithubRepo] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchProject(projectId)
      .then((p) => {
        setProject(p);
        setGithubRepoInput(p.githubRepo ?? "");
      })
      .catch(() => setNotFound(true));
    fetchProjectSessions(projectId)
      .then((res) => setSessions(res.sessions))
      .catch(() => setSessions([]));
    fetchProjectGithubEvents(projectId)
      .then((res) => setGithubEvents(res.events))
      .catch(() => setGithubEvents([]));
  }, [projectId]);

  async function saveGithubRepo() {
    setSavingGithubRepo(true);
    try {
      const trimmed = githubRepoInput.trim();
      const updated = await setProjectGithubRepo(projectId, trimmed === "" ? null : trimmed);
      // The PUT response is a bare ProjectRecord (no `stats`) - merge just the changed field in.
      setProject((prev) => (prev ? { ...prev, githubRepo: updated.githubRepo } : prev));
      fetchProjectGithubEvents(projectId)
        .then((res) => setGithubEvents(res.events))
        .catch(() => {});
    } finally {
      setSavingGithubRepo(false);
    }
  }

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
              <StatTile label="入力トークン" value={formatTokens(project.stats.inputTokens)} />
              <StatTile label="出力トークン" value={formatTokens(project.stats.outputTokens)} />
              <StatTile label="推定コスト" value={formatCost(project.stats.costUsd)} />
            </div>

            <h3 style={{ fontSize: "0.9rem" }}>🐙 GitHub連携</h3>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
              <input
                type="text"
                placeholder="owner/repo"
                value={githubRepoInput}
                onChange={(e) => setGithubRepoInput(e.target.value)}
                style={{ flex: "0 0 260px", padding: "0.35rem 0.5rem" }}
              />
              <button onClick={saveGithubRepo} disabled={savingGithubRepo}>
                {savingGithubRepo ? "保存中..." : "保存"}
              </button>
              {project.githubRepo && (
                <a href={`https://github.com/${project.githubRepo}`} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem" }}>
                  {project.githubRepo} を開く ↗
                </a>
              )}
            </div>

            {project.githubRepo && (
              <>
                <h3 style={{ fontSize: "0.9rem" }}>最近のGitHubアクティビティ</h3>
                {githubEvents.length === 0 ? (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>まだアクティビティがありません。</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.5rem" }}>
                    {githubEvents.map((event) => (
                      <li
                        key={event.id}
                        style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", padding: "0.35rem 0", borderBottom: "1px solid var(--border)" }}
                      >
                        <span>{GITHUB_EVENT_ICON[event.type] ?? "🐙"}</span>
                        {event.url ? (
                          <a href={event.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem" }}>
                            {event.payloadSummary}
                          </a>
                        ) : (
                          <span style={{ fontSize: "0.85rem" }}>{event.payloadSummary}</span>
                        )}
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                          {event.actor ? `${event.actor} · ` : ""}
                          {formatDateTime(event.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            <h3 style={{ fontSize: "0.9rem" }}>セッション履歴</h3>
            <SessionTable sessions={sessions} />
          </>
        )}
      </div>
    </AppShell>
  );
}
