"use client";

import { useOfficeStore } from "@/stores/office-store";

function formatTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString("ja-JP", { hour12: false });
}

/** docs/08_SCREEN_DESIGN.md #2: time-ordered activity log, newest first. */
export function ActivityLogList() {
  const activityLog = useOfficeStore((s) => s.activityLog);

  if (activityLog.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>まだイベントがありません</p>;
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: "0.8rem" }}>
      {activityLog.map((entry) => (
        <li
          key={entry.eventId}
          style={{
            padding: "0.35rem 0",
            borderBottom: "1px solid var(--border)",
            color: entry.status === "error" ? "var(--error)" : "var(--text)",
          }}
        >
          <span style={{ color: "var(--text-muted)", marginRight: 6 }}>{formatTime(entry.timestamp)}</span>
          {entry.message}
        </li>
      ))}
    </ul>
  );
}
