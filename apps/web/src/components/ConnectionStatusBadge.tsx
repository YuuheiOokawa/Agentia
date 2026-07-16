"use client";

import { useOfficeStore } from "@/stores/office-store";

const LABEL: Record<string, string> = {
  connected: "● connected",
  reconnecting: "◐ reconnecting…",
  offline: "○ offline",
};

const COLOR: Record<string, string> = {
  connected: "var(--success)",
  reconnecting: "#f9a825",
  offline: "var(--error)",
};

export function ConnectionStatusBadge() {
  const connectionState = useOfficeStore((s) => s.connectionState);
  return (
    <span style={{ color: COLOR[connectionState], fontSize: "0.85rem", fontWeight: 600 }}>
      {LABEL[connectionState]}
    </span>
  );
}
