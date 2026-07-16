"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/stores/project-store";

/** docs/08_SCREEN_DESIGN.md #9: sidebar project switcher, shared across every screen. */
export function ProjectSwitcher() {
  const projectRoot = useProjectStore((s) => s.projectRoot);
  const projects = useProjectStore((s) => s.projects);
  const hydrate = useProjectStore((s) => s.hydrate);
  const setProjectRoot = useProjectStore((s) => s.setProjectRoot);
  const refreshProjects = useProjectStore((s) => s.refreshProjects);

  useEffect(() => {
    hydrate();
    void refreshProjects();
  }, [hydrate, refreshProjects]);

  if (projectRoot === null) return null;

  if (projects.length === 0) {
    return <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "0 0.5rem" }}>プロジェクト未登録</p>;
  }

  return (
    <select
      value={projectRoot}
      onChange={(e) => setProjectRoot(e.target.value)}
      style={{
        width: "100%",
        padding: "0.4rem 0.5rem",
        marginBottom: "0.75rem",
        fontSize: "0.8rem",
        borderRadius: 6,
        border: "1px solid var(--border)",
      }}
    >
      {!projects.some((p) => p.rootPath === projectRoot) && <option value={projectRoot}>{projectRoot}</option>}
      {projects.map((p) => (
        <option key={p.projectId} value={p.rootPath}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
