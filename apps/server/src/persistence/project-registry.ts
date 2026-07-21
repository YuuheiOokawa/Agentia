import { mkdirSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { prisma } from "@agentia/db";

export interface ProjectRecord {
  projectId: string;
  rootPath: string;
  name: string;
  githubRepo: string | null;
  createdAt: string;
  lastSeenAt: string;
}

/**
 * docs/11_DATABASE_DESIGN.md #1/#7 (Phase 3): the project<->rootPath mapping now lives in
 * Postgres (via packages/db) instead of a local JSON file, but every read stays synchronous
 * against an in-memory cache - resolveByRoot() is on the hot path of every single hook event
 * (docs/14_BACKEND_DESIGN.md #6), so it must never make the ingest response wait on a DB
 * round-trip. Writes are fire-and-forget; call init() once at startup to warm the cache.
 */
/**
 * Windows paths are case-insensitive and accept both separators ("C:\foo" === "c:/foo"), but
 * Claude Code hook payloads report `cwd` verbatim from the shell that launched the session -
 * different terminals/sessions can report the same directory with different drive-letter casing.
 * Comparing rootPath as an exact string (as the DB's `rootPath @unique` does) then splits one
 * real project into multiple rows, each with its own stale lastSeenAt/isActive state.
 */
function normalizeRootKey(rootPath: string): string {
  return rootPath.replace(/\\/g, "/").toLowerCase();
}

export class ProjectRegistry {
  private readonly byRoot = new Map<string, ProjectRecord>();
  /** normalizeRootKey(rootPath) -> the exact rootPath string used as the byRoot key (first-seen casing wins). */
  private readonly keyByNormalizedRoot = new Map<string, string>();
  private pendingWrite: Promise<unknown> = Promise.resolve();

  private trackWrite(write: Promise<unknown>): void {
    this.pendingWrite = Promise.all([this.pendingWrite, write.catch(() => {})]);
  }

  /** Test-only synchronization point: resolves once every fire-and-forget write issued so far has settled. */
  async flush(): Promise<void> {
    await this.pendingWrite;
  }

  async init(): Promise<void> {
    const rows = await prisma.project.findMany();
    for (const row of rows) {
      this.byRoot.set(row.rootPath, {
        projectId: row.id,
        rootPath: row.rootPath,
        name: row.name,
        githubRepo: row.githubRepo,
        createdAt: row.createdAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
      });
      this.keyByNormalizedRoot.set(normalizeRootKey(row.rootPath), row.rootPath);
    }
  }

  /** Resolves (and registers, if unseen) the project for a given Claude Code cwd. */
  resolveByRoot(rootPath: string): ProjectRecord {
    const nowIso = new Date().toISOString();
    const canonicalRoot = this.keyByNormalizedRoot.get(normalizeRootKey(rootPath));
    const existing = canonicalRoot ? this.byRoot.get(canonicalRoot) : undefined;
    if (existing) {
      existing.lastSeenAt = nowIso;
      this.trackWrite(prisma.project.update({ where: { id: existing.projectId }, data: { lastSeenAt: new Date(nowIso) } }));
      return existing;
    }

    const projectId = this.uniqueProjectId(rootPath);
    const record: ProjectRecord = {
      projectId,
      rootPath,
      name: basename(rootPath) || rootPath,
      githubRepo: null,
      createdAt: nowIso,
      lastSeenAt: nowIso,
    };
    this.byRoot.set(rootPath, record);
    this.keyByNormalizedRoot.set(normalizeRootKey(rootPath), rootPath);
    this.trackWrite(
      prisma.project.create({ data: { id: projectId, name: record.name, rootPath, createdAt: new Date(nowIso), lastSeenAt: new Date(nowIso) } })
    );
    return record;
  }

  private uniqueProjectId(rootPath: string): string {
    const base = `proj_${basename(rootPath) || "default"}`;
    const taken = new Set(Array.from(this.byRoot.values()).map((r) => r.projectId));
    if (!taken.has(base)) return base;
    let suffix = 2;
    while (taken.has(`${base}_${suffix}`)) suffix += 1;
    return `${base}_${suffix}`;
  }

  get(projectId: string): ProjectRecord | undefined {
    for (const record of this.byRoot.values()) {
      if (record.projectId === projectId) return record;
    }
    return undefined;
  }

  list(): ProjectRecord[] {
    return Array.from(this.byRoot.values()).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  /** Registers a project immediately (e.g. from the connection-setup screen), before any hook event arrives. */
  ensureRegistered(rootPath: string): ProjectRecord {
    return this.resolveByRoot(rootPath);
  }

  /** Links a GitHub repo ("owner/repo") to a project (docs/13 GitHub連携, Phase 3). */
  async setGithubRepo(projectId: string, githubRepo: string | null): Promise<ProjectRecord | undefined> {
    const record = this.get(projectId);
    if (!record) return undefined;
    record.githubRepo = githubRepo;
    // upsert (not update): resolveByRoot's initial `create` is fire-and-forget and may not have landed yet.
    await prisma.project.upsert({
      where: { id: projectId },
      create: {
        id: projectId,
        name: record.name,
        rootPath: record.rootPath,
        githubRepo,
        createdAt: new Date(record.createdAt),
        lastSeenAt: new Date(record.lastSeenAt),
      },
      update: { githubRepo },
    });
    return record;
  }

  findByGithubRepo(githubRepo: string): ProjectRecord | undefined {
    for (const record of this.byRoot.values()) {
      if (record.githubRepo === githubRepo) return record;
    }
    return undefined;
  }
}

export function ensureDataDir(dataDir: string): void {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
}
