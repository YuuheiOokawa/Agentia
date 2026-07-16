export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem 1rem", background: "var(--panel-bg)" }}>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}
