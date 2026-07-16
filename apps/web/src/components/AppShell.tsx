"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";

/** docs/08_SCREEN_DESIGN.md #0: common nav. MVP only wires up Office + Connection Settings (docs/17 #1). */
const NAV_ITEMS = [
  { href: "/office", label: "バーチャルオフィス" },
  { href: "/settings/connection", label: "Claude Code接続設定" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside
        style={{
          width: 220,
          borderRight: "1px solid var(--border)",
          background: "var(--panel-bg)",
          padding: "1rem 0.75rem",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "1.1rem", padding: "0 0.5rem 1rem" }}>Agentia</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "0.5rem 0.6rem",
                borderRadius: 6,
                textDecoration: "none",
                background: pathname === item.href ? "var(--accent)" : "transparent",
                color: pathname === item.href ? "#fff" : "var(--text)",
                fontSize: "0.9rem",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            height: 48,
            borderBottom: "1px solid var(--border)",
            background: "var(--panel-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 1rem",
            flexShrink: 0,
          }}
        >
          <ConnectionStatusBadge />
        </header>
        <main style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
