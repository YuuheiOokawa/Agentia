"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useOfficeSocket } from "@/hooks/use-office-socket";
import { useMovementTicker } from "@/hooks/use-movement-ticker";
import { useProjectStore, currentProjectId } from "@/stores/project-store";

/** docs/08_SCREEN_DESIGN.md #0: common nav across all Phase 2 screens. */
const NAV_ITEMS = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/office", label: "バーチャルオフィス" },
  { href: "/history", label: "セッション履歴" },
  { href: "/projects", label: "プロジェクト一覧" },
  { href: "/stats", label: "統計" },
  { href: "/settings/connection", label: "Claude Code接続設定" },
];

/**
 * Owns the single app-wide WebSocket connection and "current project" hydration so every
 * screen (not just Office/Dashboard) shares one live connection and one source of truth for
 * which project is selected (docs/06_REALTIME_COMMUNICATION.md, docs/08 #9 ProjectSwitcher).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const projectRoot = useProjectStore((s) => s.projectRoot);
  const hydrate = useProjectStore((s) => s.hydrate);

  useEffect(() => hydrate(), [hydrate]);

  const projectId = currentProjectId(projectRoot) ?? "proj_default";
  useOfficeSocket(projectId);
  useMovementTicker();

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside
        style={{
          width: 220,
          borderRight: "1px solid var(--border)",
          background: "var(--panel-bg)",
          padding: "1rem 0.75rem",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "1.1rem", padding: "0 0.5rem 1rem" }}>Agentia</div>
        <ProjectSwitcher />
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "0.5rem 0.6rem",
                  borderRadius: 6,
                  textDecoration: "none",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "var(--text)",
                  fontSize: "0.9rem",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            height: 48,
            borderBottom: "1px solid var(--border)",
            background: "var(--panel-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 1rem",
            flexShrink: 0,
          }}
        >
          <ConnectionStatusBadge />
        </header>
        <main style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
