"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ActivityLogList } from "@/components/ActivityLogList";
import { CurrentTaskCards } from "@/components/CurrentTaskCards";
import { useOfficeSocket } from "@/hooks/use-office-socket";
import { useMovementTicker } from "@/hooks/use-movement-ticker";
import { useOfficeStore } from "@/stores/office-store";
import { resolveProjectId } from "@/lib/project";
import { DEFAULT_PROJECT_ROOT_STORAGE_KEY } from "@/lib/constants";

// PixiJS's <Stage> needs a real canvas/WebGL context, so it must never run during SSR.
const OfficeCanvas = dynamic(() => import("./canvas/OfficeCanvas").then((m) => m.OfficeCanvas), { ssr: false });

export function OfficeScreen() {
  const [projectRoot, setProjectRoot] = useState<string | null>(null);

  useEffect(() => {
    setProjectRoot(window.localStorage.getItem(DEFAULT_PROJECT_ROOT_STORAGE_KEY) ?? "");
  }, []);

  const projectId = resolveProjectId(projectRoot ?? "");
  useOfficeSocket(projectId);
  useMovementTicker();
  const claudeCodeOffline = useOfficeStore((s) => s.claudeCodeOffline);

  if (projectRoot === null) return null;

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
