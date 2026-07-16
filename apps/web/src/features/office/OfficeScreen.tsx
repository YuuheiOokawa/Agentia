"use client";

import dynamic from "next/dynamic";
import { AppShell } from "@/components/AppShell";
import { ActivityLogList } from "@/components/ActivityLogList";
import { CurrentTaskCards } from "@/components/CurrentTaskCards";
import { useOfficeStore } from "@/stores/office-store";
import { useProjectStore } from "@/stores/project-store";

// PixiJS's <Stage> needs a real canvas/WebGL context, so it must never run during SSR.
const OfficeCanvas = dynamic(() => import("./canvas/OfficeCanvas").then((m) => m.OfficeCanvas), { ssr: false });

export function OfficeScreen() {
  // AppShell owns the WebSocket connection + project hydration (shared across every screen);
  // this component only needs to know whether that hydration has completed yet.
  const projectRoot = useProjectStore((s) => s.projectRoot);
  const claudeCodeOffline = useOfficeStore((s) => s.claudeCodeOffline);

  if (projectRoot === null) {
    return (
      <AppShell>
        <div style={{ padding: "1.5rem" }} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: "1rem" }}>
          {claudeCodeOffline && (
            <div
              style={{
                position: "absolute",
                top: 56,
                background: "var(--error)",
                color: "#fff",
                padding: "0.4rem 1rem",
                borderRadius: 6,
                fontSize: "0.85rem",
              }}
            >
              Claude Codeとの接続が途絶えました
            </div>
          )}
          <OfficeCanvas />
        </div>
        <aside
          style={{
            width: 300,
            borderLeft: "1px solid var(--border)",
            background: "var(--panel-bg)",
            padding: "1rem",
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          <h3 style={{ fontSize: "0.9rem", margin: "0 0 0.5rem" }}>現在の作業</h3>
          <CurrentTaskCards />
          <h3 style={{ fontSize: "0.9rem", margin: "1.25rem 0 0.5rem" }}>アクティビティログ</h3>
          <ActivityLogList />
        </aside>
      </div>
    </AppShell>
  );
}
