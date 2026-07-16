"use client";

import Link from "next/link";
import type { SessionSummary } from "@/lib/api";
import { formatCost, formatDateTime, formatDuration } from "@/lib/format";

/** docs/08_SCREEN_DESIGN.md #3: shared by the session-history list and a project's detail page. */
export function SessionTable({ sessions }: { sessions: SessionSummary[] }) {
  if (sessions.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>セッションがありません</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
            <th style={{ padding: "0.5rem" }}>日時</th>
            <th style={{ padding: "0.5rem" }}>時間</th>
            <th style={{ padding: "0.5rem" }}>編集</th>
            <th style={{ padding: "0.5rem" }}>読込</th>
            <th style={{ padding: "0.5rem" }}>Bash</th>
            <th style={{ padding: "0.5rem" }}>テスト成功/失敗</th>
            <th style={{ padding: "0.5rem" }}>Sub Agent</th>
            <th style={{ padding: "0.5rem" }}>コスト</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.sessionId} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.5rem" }}>
                <Link href={`/history/${encodeURIComponent(s.sessionId)}`} style={{ color: "var(--accent)" }}>
                  {formatDateTime(s.startedAt)}
                </Link>
              </td>
              <td style={{ padding: "0.5rem" }}>
                {s.endedAt ? formatDuration(Date.parse(s.endedAt) - Date.parse(s.startedAt)) : "進行中"}
              </td>
              <td style={{ padding: "0.5rem" }}>{s.editCount}</td>
              <td style={{ padding: "0.5rem" }}>{s.readCount}</td>
              <td style={{ padding: "0.5rem" }}>{s.bashCount}</td>
              <td style={{ padding: "0.5rem" }}>
                {s.testSuccessCount}/{s.testFailureCount}
              </td>
              <td style={{ padding: "0.5rem" }}>{s.subAgentCount}</td>
              <td style={{ padding: "0.5rem" }}>{s.costUsd > 0 ? formatCost(s.costUsd) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
