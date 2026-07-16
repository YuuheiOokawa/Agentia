"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatTile } from "@/components/StatTile";
import { useProjectStore, currentProjectId } from "@/stores/project-store";
import { fetchStats, type StatsResponse } from "@/lib/api";
import { formatPercent } from "@/lib/format";

const RANGES = [
  { value: "day", label: "日" },
  { value: "week", label: "週" },
  { value: "month", label: "月" },
];

function ToolBar({ label, ratio, color }: { label: string; ratio: number; color: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
        <span>{label}</span>
        <span>{formatPercent(ratio)}</span>
      </div>
      <div style={{ background: "var(--bg)", borderRadius: 4, height: 8 }}>
        <div style={{ width: `${Math.round(ratio * 100)}%`, background: color, height: 8, borderRadius: 4 }} />
      </div>
    </div>
  );
}

export function StatsScreen() {
  // AppShell owns project hydration (shared across every screen).
  const projectRoot = useProjectStore((s) => s.projectRoot);
  const [range, setRange] = useState("week");
  const [stats, setStats] = useState<StatsResponse | null>(null);

  const projectId = currentProjectId(projectRoot);

  useEffect(() => {
    fetchStats(range, projectId ?? undefined)
      .then(setStats)
      .catch(() => setStats(null));
  }, [range, projectId]);

  const maxMinutes = Math.max(1, ...(stats?.dailyActiveMinutes.map((d) => d.minutes) ?? [1]));

  return (
    <AppShell>
      <div style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>統計</h2>
          <select value={range} onChange={(e) => setRange(e.target.value)} style={{ padding: "0.3rem 0.5rem" }}>
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                期間: {r.label}
              </option>
            ))}
          </select>
        </div>

        {stats && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <StatTile label="セッション数" value={stats.sessionCount} />
              <StatTile label="テスト成功率" value={formatPercent(stats.testSuccessRate)} />
              <StatTile label="平均Sub Agent数/セッション" value={stats.averageSubAgentsPerSession.toFixed(1)} />
            </div>

            <h3 style={{ fontSize: "0.9rem" }}>利用時間推移</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, marginBottom: "1.5rem" }}>
              {stats.dailyActiveMinutes.length === 0 && (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>データがありません</p>
              )}
              {stats.dailyActiveMinutes.map((d) => (
                <div key={d.date} style={{ textAlign: "center", fontSize: "0.7rem" }}>
                  <div
                    style={{
                      width: 24,
                      height: Math.max(4, (d.minutes / maxMinutes) * 80),
                      background: "var(--accent)",
                      borderRadius: 3,
                    }}
                    title={`${d.minutes}分`}
                  />
                  <div style={{ marginTop: 4, color: "var(--text-muted)" }}>{d.date.slice(5)}</div>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: "0.9rem" }}>ツール利用内訳</h3>
            <div style={{ maxWidth: 360 }}>
              <ToolBar label="Edit" ratio={stats.toolBreakdown.edit} color="#1e88e5" />
              <ToolBar label="Read" ratio={stats.toolBreakdown.read} color="#43a047" />
              <ToolBar label="Bash" ratio={stats.toolBreakdown.bash} color="#f9a825" />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
