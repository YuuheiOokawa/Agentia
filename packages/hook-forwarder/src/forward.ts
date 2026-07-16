import type { IngestRequest, RawHookPayload } from "@agentia/shared-types";

const DEFAULT_PORT = 4317;
const DEFAULT_TIMEOUT_MS = 2000;

export function resolveIngestUrl(): string {
  if (process.env["AGENTIA_INGEST_URL"]) {
    return process.env["AGENTIA_INGEST_URL"];
  }
  const port = process.env["AGENTIA_SERVER_PORT"] ?? String(DEFAULT_PORT);
  return `http://127.0.0.1:${port}/internal/events`;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Reads one Claude Code hook payload from stdin and forwards it to the Agentia
 * Ingest API (docs/04_CLAUDE_CODE_INTEGRATION.md #1). This must never throw and
 * must never delay Claude Code beyond the hook's configured timeout: forwarding
 * failures are swallowed, and we always print a fire-and-forget response.
 */
export async function main(): Promise<void> {
  const timeoutMs = Number(process.env["AGENTIA_HOOK_TIMEOUT_MS"] ?? DEFAULT_TIMEOUT_MS);

  try {
    const raw = await readStdin();
    const payload = JSON.parse(raw) as RawHookPayload;
    const hookEventName = payload.hook_event_name;

    const clientEventId =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const body: IngestRequest = { clientEventId, hookEventName, payload };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(resolveIngestUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      // Ingest server unreachable/slow: Claude Code must proceed regardless.
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Malformed stdin, etc. Never surface an error back to Claude Code.
  } finally {
    process.stdout.write(JSON.stringify({ async: true }));
    process.exitCode = 0;
  }
}
