"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatTile } from "@/components/StatTile";
import { fetchSession, fetchSessionEvents, type SessionSummary } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/format";

interface EventRow {
  eventId: string;
  timestamp: string;
  message: string;
  status: string;
}

export function HistoryDetailScreen({ sessionId }: { sessionId: string }) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchSession(sessionId)
      .then(setSummary)
      .catch(() => setNotFound(true));
    fetchSessionEvents(sessionId)
      .then((res) => setEvents(res.events))
      .catch(() => setEvents([]));
  }, [sessionId]);

  return (
    <AppShell>
      <div style={{ padding: "1.5rem" }}>
        <Link href="/history" style={{ fontSize: "0.85rem", color: "var(--accent)" }}>
          ← セッション履歴へ
        </Link>
        <h2 style={{ marginTop: "0.5rem" }}>セッション詳細</h2>

        {notFound && <p>セッションが見つかりませんでした。</p>}

        {summary && (
          <>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {formatDateTime(summary.startedAt)} 開始 ・{" "}
              {summary.endedAt ? formatDuration(Date.parse(summary.endedAt) - Date.parse(summary.startedAt)) : "進行中"}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.75rem", margin: "1rem 0" }}>
              <StatTile label="編集" value={summary.editCount} />
              <StatTile label="読込" value={summary.readCount} />
              <StatTile label="Bash実行" value={summary.bashCount} />
              <StatTile label="テスト成功/失敗" value={`${summary.testSuccessCount} / ${summary.testFailureCount}`} />
              <StatTile label="Sub Agent" value={summary.subAgentCount} />
            </div>
          </>
        )}

        <h3 style={{ fontSize: "0.9rem" }}>イベントログ</h3>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: "0.8rem", maxWidth: 640 }}>
          {events.map((e) => (
            <li
              key={e.eventId}
              style={{
                padding: "0.35rem 0",
                borderBottom: "1px solid var(--border)",
                color: e.status === "error" ? "var(--error)" : "var(--text)",
              }}
            >
              <span style={{ color: "var(--text-muted)", marginRight: 6 }}>
                {new Date(e.timestamp).toLocaleTimeString("ja-JP", { hour12: false })}
              </span>
              {e.message}
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
