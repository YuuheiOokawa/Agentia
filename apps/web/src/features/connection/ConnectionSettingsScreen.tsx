"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SERVER_HTTP_URL } from "@/lib/constants";
import { useProjectStore } from "@/stores/project-store";

interface StatusResponse {
  ingestServer: string;
  port: number;
  hooksStatus: "configured" | "missing" | "unknown";
}

/** docs/08_SCREEN_DESIGN.md #8: onboarding/setup screen for wiring up Claude Code Hooks. */
export function ConnectionSettingsScreen() {
  const projectRoot = useProjectStore((s) => s.projectRoot);
  const hydrate = useProjectStore((s) => s.hydrate);
  const saveProjectRoot = useProjectStore((s) => s.setProjectRoot);
  const refreshProjects = useProjectStore((s) => s.refreshProjects);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [setupResult, setSetupResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => hydrate(), [hydrate]);

  async function refreshStatus(root: string) {
    const params = root ? `?projectRoot=${encodeURIComponent(root)}` : "";
    const res = await fetch(`${SERVER_HTTP_URL}/api/connection/status${params}`);
    setStatus((await res.json()) as StatusResponse);
  }

  useEffect(() => {
    if (projectRoot !== null) void refreshStatus(projectRoot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectRoot !== null]);

  async function handleSetup() {
    if (projectRoot === null) return;
    setBusy(true);
    setSetupResult(null);
    try {
      const res = await fetch(`${SERVER_HTTP_URL}/api/connection/setup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectRoot }),
      });
      const body = (await res.json()) as { changed: boolean; settingsPath: string };
      setSetupResult(
        body.changed
          ? `Hooksを設定しました: ${body.settingsPath}`
          : `既に設定済みです: ${body.settingsPath}`
      );
      await refreshStatus(projectRoot);
      await refreshProjects();
    } catch {
      setSetupResult("Ingest Serverに接続できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setTestResult(null);
    try {
      const res = await fetch(`${SERVER_HTTP_URL}/api/connection/test`, { method: "POST" });
      const body = (await res.json()) as { message: string };
      setTestResult(body.message);
    } catch {
      setTestResult("Ingest Serverに接続できませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div style={{ padding: "1.5rem", maxWidth: 640 }}>
        <h2 style={{ marginTop: 0 }}>Claude Code接続設定</h2>

        <p style={{ fontSize: "0.9rem" }}>
          Ingest Server:{" "}
          {status ? (
            <strong>
              ● 起動中 ({SERVER_HTTP_URL.replace(/^https?:\/\//, "")})
            </strong>
          ) : (
            "接続を確認中…"
          )}
        </p>

        <label style={{ display: "block", fontSize: "0.85rem", marginTop: "1rem" }}>
          プロジェクトのルートパス(Claude Codeを起動しているディレクトリ)
          <input
            value={projectRoot ?? ""}
            onChange={(e) => saveProjectRoot(e.target.value)}
            placeholder="/home/user/my-project"
            style={{ display: "block", width: "100%", marginTop: 4, padding: "0.4rem 0.5rem" }}
          />
        </label>

        <p style={{ fontSize: "0.85rem", marginTop: "1rem" }}>
          .claude/settings.json:{" "}
          {status?.hooksStatus === "configured" && <strong>● 設定済み</strong>}
          {status?.hooksStatus === "missing" && <strong>⚠ Hooks未設定</strong>}
          {(!status || status.hooksStatus === "unknown") && "プロジェクトパスを入力してください"}
        </p>

        <button disabled={busy || !projectRoot} onClick={handleSetup} style={{ marginRight: 8 }}>
          ワンクリックで設定を追加
        </button>
        <button disabled={busy} onClick={handleTest}>
          接続テストを実行
        </button>

        {setupResult && <p style={{ fontSize: "0.85rem" }}>{setupResult}</p>}
        {testResult && <p style={{ fontSize: "0.85rem" }}>{testResult}</p>}

        <details style={{ marginTop: "1.5rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.85rem" }}>手動設定用のJSONを表示</summary>
          <pre style={{ fontSize: "0.75rem", background: "var(--bg)", padding: "0.75rem", overflowX: "auto" }}>
            {`.claude/settings.json に .claude/settings.example.json (リポジトリ同梱) の内容をマージしてください。`}
          </pre>
        </details>
      </div>
    </AppShell>
  );
}
