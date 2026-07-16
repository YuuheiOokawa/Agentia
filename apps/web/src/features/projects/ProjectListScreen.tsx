"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProjectCard } from "@/components/ProjectCard";
import { fetchProjects, type ProjectRecord } from "@/lib/api";

export function ProjectListScreen() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchProjects()
      .then((res) => setProjects(res.projects))
      .catch(() => setProjects([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <AppShell>
      <div style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>プロジェクト一覧</h2>
          <Link href="/settings/connection" style={{ fontSize: "0.85rem", color: "var(--accent)" }}>
            + プロジェクトを追加
          </Link>
        </div>

        {loaded && projects.length === 0 && (
          <p style={{ fontSize: "0.9rem", marginTop: "1rem" }}>
            まだプロジェクトが登録されていません。<Link href="/settings/connection">Claude Code接続設定</Link>から追加してください。
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "1rem" }}>
          {projects.map((p) => (
            <ProjectCard key={p.projectId} project={p} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
