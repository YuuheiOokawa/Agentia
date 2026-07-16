import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { InternalEvent } from "@agentia/shared-types";

/** docs/11_DATABASE_DESIGN.md #1: MVP persistence is JSONL-per-session, no DB. */
export class JsonlWriter {
  private ready: Promise<void> | null = null;

  constructor(private readonly logDir: string) {}

  private async ensureDir(): Promise<void> {
    if (!this.ready) this.ready = mkdir(this.logDir, { recursive: true }).then(() => undefined);
    return this.ready;
  }

  async append(sessionId: string, event: InternalEvent): Promise<void> {
    try {
      await this.ensureDir();
      const filePath = join(this.logDir, `${sessionId}.jsonl`);
      await appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
    } catch {
      // docs/14_BACKEND_DESIGN.md #6: disk failures degrade to ring-buffer-only, never crash the server.
    }
  }
}
