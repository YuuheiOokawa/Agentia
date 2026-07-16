"use client";

import { useOfficeStore } from "@/stores/office-store";

const STATE_LABEL: Record<string, string> = {
  idle: "待機中",
  moving: "移動中",
  researching: "調査中",
  reading: "読込中",
  planning: "計画中",
  coding: "実装中",
  terminal: "コマンド実行中",
  testing: "テスト中",
  deploying: "デプロイ中",
  waiting: "入力待ち",
  error: "エラー",
  completed: "完了",
};

export function CurrentTaskCards() {
  const employees = useOfficeStore((s) => s.employees);
  const list = Object.values(employees);

  if (list.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>稼働中のAI社員はいません</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {list.map((employee) => (
        <div
          key={employee.agentId}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "0.6rem 0.75rem",
            background: employee.hasWarning ? "#fdecea" : "var(--panel-bg)",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{employee.displayName}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {STATE_LABEL[employee.state] ?? employee.state}
          </div>
          {employee.currentTask && <div style={{ fontSize: "0.8rem", marginTop: 4 }}>{employee.currentTask}</div>}
        </div>
      ))}
    </div>
  );
}
