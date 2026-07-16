"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatTile } from "@/components/StatTile";
import { CurrentTaskCards } from "@/components/CurrentTaskCards";
import { ActivityLogList } from "@/components/ActivityLogList";
import { useOfficeStore } from "@/stores/office-store";
import { useProjectStore, currentProjectId } from "@/stores/project-store";
import { fetchProject, type ProjectRecord } from "@/lib/api";
import { formatCost, formatDuration } from "@/lib/format";

export function DashboardScreen() {
  // AppShell owns the WebSocket connection + project hydration (shared across every screen).
  const projectRoot = useProjectStore((s) => s.projectRoot);
  const [project, setProject] = useState<ProjectRecord | null>(null);

  const projectId = currentProjectId(projectRoot);
  const employeeCount = useOfficeStore((s) => Object.keys(s.employees).length);

  useEffect(() => {
    if (!projectId) return;
    fetchProject(projectId)
      .then(setProject)
      .catch(() => setProject(null));
  }, [projectId]);

  return (
    <AppShell>
      <div style={{ padding: "1.5rem" }}>
        {projectRoot === null && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>読み込み中…</p>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>今日のサマリ</h2>
          <Link href="/office" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
            オフィスを見る →
          </Link>
        </div>

        {!projectRoot && (
          <p style={{ fontSize: "0.9rem" }}>
            プロジェクトが未設定です。<Link href="/settings/connection">Claude Code接続設定</Link>から登録してください。
          </p>
        )}

        {project && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <StatTile label="総利用時間" value={formatDuration(project.stats.totalActiveMs)} />
            <StatTile label="編集ファイル" value={project.stats.editCount} />
            <StatTile label="Bash実行" value={project.stats.bashCount} />
            <StatTile label="テスト成功/失敗" value={`${project.stats.testSuccessCount} / ${project.stats.testFailureCount}`} />
            <StatTile label="推定コスト" value={formatCost(project.stats.costUsd)} />
          </div>
        )}

        <h3 style={{ fontSize: "0.95rem" }}>AI社員 ({employeeCount}名 稼働中)</h3>
        <div style={{ marginBottom: "1.5rem" }}>
          <CurrentTaskCards />
        </div>

        <h3 style={{ fontSize: "0.95rem" }}>最近のアクティビティ</h3>
        <div style={{ maxWidth: 480 }}>
          <ActivityLogList />
        </div>
      </div>
    </AppShell>
  );
}
