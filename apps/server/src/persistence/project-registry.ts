import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

export interface ProjectRecord {
  projectId: string;
  rootPath: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
}

/**
 * docs/11_DATABASE_DESIGN.md #1: MVP/Phase2 has no DB yet, so the project<->rootPath mapping
 * (needed to survive server restarts, unlike SessionManager's in-memory session state) is a
 * small JSON file under AGENTIA_DATA_DIR. Phase3 replaces this with the Project table.
 */
export class ProjectRegistry {
  private readonly filePath: string;
  private records: Map<string, ProjectRecord>;

  constructor(dataDir: string) {
    this.filePath = join(dataDir, "projects.json");
    this.records = this.load(dataDir);
  }

  private load(dataDir: string): Map<string, ProjectRecord> {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as ProjectRecord[];
      return new Map(parsed.map((r) => [r.projectId, r]));
    } catch {
      mkdirSync(dataDir, { recursive: true });
      return new Map();
    }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(Array.from(this.records.values()), null, 2), "utf8");
    } catch {
      // docs/14_BACKEND_DESIGN.md #6: persistence failures degrade gracefully, never crash ingestion.
    }
  }

  /** Resolves (and registers, if unseen) the project for a given Claude Code cwd. */
  resolveByRoot(rootPath: string): ProjectRecord {
    const nowIso = new Date().toISOString();
    for (const record of this.records.values()) {
      if (record.rootPath === rootPath) {
        record.lastSeenAt = nowIso;
        this.save();
        return record;
      }
    }
    const projectId = this.uniqueProjectId(rootPath);
    const record: ProjectRecord = {
      projectId,
      rootPath,
      name: basename(rootPath) || rootPath,
      createdAt: nowIso,
      lastSeenAt: nowIso,
    };
    this.records.set(projectId, record);
    this.save();
    return record;
  }

  private uniqueProjectId(rootPath: string): string {
    const base = `proj_${basename(rootPath) || "default"}`;
    if (!this.records.has(base)) return base;
    let suffix = 2;
    while (this.records.has(`${base}_${suffix}`)) suffix += 1;
    return `${base}_${suffix}`;
  }

  get(projectId: string): ProjectRecord | undefined {
    return this.records.get(projectId);
  }

  list(): ProjectRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  /** Registers a project immediately (e.g. from the connection-setup screen), before any hook event arrives. */
  ensureRegistered(rootPath: string): ProjectRecord {
    return this.resolveByRoot(rootPath);
  }
}

export function ensureDataDir(dataDir: string): void {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
}
