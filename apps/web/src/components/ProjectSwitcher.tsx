"use client";

import { useEffect } from "react";
import { COMPANY_VIEW_SENTINEL } from "@/lib/constants";
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

  const isKnownProject = projects.some((p) => p.rootPath === projectRoot);

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
      {/* docs/10_OFFICE_SYSTEM.md: everyone sharing one office is the default, not a per-project silo. */}
      <option value={COMPANY_VIEW_SENTINEL}>全社(すべてのプロジェクト)</option>
      {!isKnownProject && projectRoot !== COMPANY_VIEW_SENTINEL && <option value={projectRoot}>{projectRoot}</option>}
      {projects.map((p) => (
        <option key={p.projectId} value={p.rootPath}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
