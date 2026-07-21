"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ActivityLogList } from "@/components/ActivityLogList";
import { CurrentTaskCards } from "@/components/CurrentTaskCards";
import { useOfficeStore } from "@/stores/office-store";
import { useProjectStore } from "@/stores/project-store";

// PixiJS's <Stage> needs a real canvas/WebGL context, so it must never run during SSR.
const OfficeCanvas = dynamic(() => import("./canvas/OfficeCanvas").then((m) => m.OfficeCanvas), { ssr: false });

const STATE_LABEL: Record<string, string> = {
  idle: "待機中",
  moving: "移動中",
  researching: "調査中",
  reading: "資料読み込み中",
  planning: "計画中",
  coding: "実装中",
  terminal: "コマンド実行中",
  testing: "テスト中",
  deploying: "デプロイ中",
  waiting: "入力待ち",
  error: "エラー対応中",
  completed: "完了",
};

function elapsedLabel(fromIso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  return `${Math.floor(seconds / 3600)}時間${Math.floor((seconds % 3600) / 60)}分`;
}

/** STEP10: clicking a character in the canvas opens this card (name/session/state/task/elapsed). */
function EmployeeDetailCard() {
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const employee = useOfficeStore((s) => (s.selectedAgentId ? s.employees[s.selectedAgentId] : undefined));
  const selectEmployee = useOfficeStore((s) => s.selectEmployee);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!selectedAgentId) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [selectedAgentId]);

  if (!selectedAgentId) return null;

  const rows: Array<[string, string]> = employee
    ? [
        ["ロール", employee.role],
        ["セッション", employee.sessionId.slice(0, 18)],
        ["状態", STATE_LABEL[employee.state] ?? employee.state],
        ["現在の作業", employee.currentTask ?? "-"],
        ["使用ツール", employee.currentTool ?? "-"],
        ["経過時間", elapsedLabel(employee.spawnedAt, now)],
      ]
    : [];

  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        bottom: 16,
        width: 260,
        background: "var(--panel-bg)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "0.75rem 0.9rem",
        boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        zIndex: 5,
        fontSize: "0.82rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <strong>{employee ? employee.displayName : "退勤済み"}</strong>
        <button
          onClick={() => selectEmployee(null)}
          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "0.9rem", color: "var(--text)" }}
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
      {employee ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: "2px 6px 2px 0", color: "var(--muted, #777)", whiteSpace: "nowrap", verticalAlign: "top" }}>{label}</td>
                <td style={{ padding: "2px 0", wordBreak: "break-word" }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div>この社員のセッションは終了しました。</div>
      )}
    </div>
  );
}

export function OfficeScreen() {
  // AppShell owns the WebSocket connection + project hydration (shared across every screen);
  // this component only needs to know whether that hydration has completed yet.
  const projectRoot = useProjectStore((s) => s.projectRoot);
  const claudeCodeOffline = useOfficeStore((s) => s.claudeCodeOffline);
  const activeEmployees = useOfficeStore((s) => Object.keys(s.employees).length);

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
        {/* Dark backdrop matching the canvas background so the diorama blends into the page. */}
        <div
          style={{
            flex: 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "auto",
            padding: "1.5rem",
            background: "radial-gradient(circle at 50% 32%, #313947 0%, #202631 48%, #171b23 100%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 22,
              top: 18,
              zIndex: 4,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "0.55rem 0.75rem",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              background: "rgba(17, 22, 30, 0.82)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
              backdropFilter: "blur(10px)",
              color: "#eef4ff",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                display: "grid",
                placeItems: "center",
                borderRadius: 8,
                background: "linear-gradient(145deg, #4b8dff, #2457c6)",
                boxShadow: "0 0 18px rgba(75,141,255,0.32)",
                fontWeight: 800,
              }}
            >
              A
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#93a2b8", letterSpacing: "0.12em" }}>
                AGENTIA OPERATIONS CENTER
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2, fontSize: "0.78rem" }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: claudeCodeOffline ? "#ff6b6b" : "#62dc8f",
                    boxShadow: claudeCodeOffline ? "0 0 9px #ff6b6b" : "0 0 9px #62dc8f",
                  }}
                />
                {claudeCodeOffline ? "OFFLINE" : "LIVE"} · {activeEmployees} AGENTS
              </div>
            </div>
          </div>
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
          <EmployeeDetailCard />
        </div>
        <aside
          style={{
            width: 324,
            borderLeft: "1px solid rgba(111, 130, 158, 0.24)",
            background: "linear-gradient(180deg, #171d27 0%, #111720 100%)",
            color: "#edf3fb",
            padding: "1.1rem",
            overflowY: "auto",
            flexShrink: 0,
            boxShadow: "-10px 0 30px rgba(0,0,0,0.18)",
          }}
        >
          <h3 style={{ fontSize: "0.9rem", margin: "0 0 0.5rem" }}>現在の作業</h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.7rem 0 0.85rem",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              marginBottom: "0.8rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.68rem", color: "#7f91a9", letterSpacing: "0.1em" }}>WORKFORCE</div>
              <strong style={{ fontSize: "0.92rem" }}>Live operations</strong>
            </div>
            <span
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: 999,
                background: "rgba(98,220,143,0.12)",
                color: "#78e6a0",
                fontSize: "0.72rem",
                border: "1px solid rgba(98,220,143,0.2)",
              }}
            >
              {activeEmployees} active
            </span>
          </div>
          <CurrentTaskCards />
          <h3 style={{ fontSize: "0.9rem", margin: "1.25rem 0 0.5rem" }}>アクティビティログ</h3>
          <ActivityLogList />
        </aside>
      </div>
    </AppShell>
  );
}
