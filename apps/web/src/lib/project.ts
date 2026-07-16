/** Mirrors the server's `proj_${basename(cwd)}` rule (apps/server/src/core/session-manager.ts). */
export function resolveProjectId(projectRoot: string): string {
  const trimmed = projectRoot.replace(/\/+$/, "");
  const base = trimmed.split("/").pop() || "default";
  return `proj_${base}`;
}
