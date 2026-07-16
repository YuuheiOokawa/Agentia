"use client";

import Link from "next/link";
import type { ProjectRecord } from "@/lib/api";
import { formatDuration } from "@/lib/format";

const IDLE_THRESHOLD_MS = 30 * 60 * 1000;

export function ProjectCard({ project }: { project: ProjectRecord }) {
  const isActive = Date.now() - Date.parse(project.lastSeenAt) < IDLE_THRESHOLD_MS;
  return (
    <Link
      href={`/projects/${encodeURIComponent(project.projectId)}`}
      style={{
        display: "block",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "1rem",
        background: "var(--panel-bg)",
        textDecoration: "none",
        color: "var(--text)",
        minWidth: 220,
      }}
    >
      <div style={{ fontWeight: 700 }}>📁 {project.name}</div>
      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0.25rem 0" }}>
        最終利用: {new Date(project.lastSeenAt).toLocaleDateString("ja-JP")}
      </div>
      <div style={{ fontSize: "0.85rem" }}>累計 {formatDuration(project.stats.totalActiveMs)}</div>
      <div style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
        {isActive ? <span style={{ color: "var(--success)" }}>● 稼働中</span> : <span style={{ color: "var(--text-muted)" }}>○ アイドル</span>}
      </div>
    </Link>
  );
}
