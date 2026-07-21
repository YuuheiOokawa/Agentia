import { create } from "zustand";
import { COMPANY_VIEW_SENTINEL, DEFAULT_PROJECT_ROOT_STORAGE_KEY } from "@/lib/constants";
import { resolveProjectId } from "@/lib/project";
import { fetchProjects, type ProjectRecord } from "@/lib/api";

interface ProjectStoreState {
  /** null = not yet hydrated from localStorage (avoids SSR/client hydration mismatches). */
  projectRoot: string | null;
  projects: ProjectRecord[];
  hydrate: () => void;
  setProjectRoot: (root: string) => void;
  refreshProjects: () => Promise<void>;
}

/** docs/14_SCREEN nav #9 ProjectSwitcher: the single source of truth for "which project am I looking at". */
export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projectRoot: null,
  projects: [],

  hydrate: () => {
    if (get().projectRoot !== null) return;
    // First-ever visit (nothing in localStorage yet): default to the shared company-wide office
    // instead of a single project, per docs/10_OFFICE_SYSTEM.md - "one project at a time" is now
    // an opt-in narrowing via the ProjectSwitcher, not the default.
    set({ projectRoot: window.localStorage.getItem(DEFAULT_PROJECT_ROOT_STORAGE_KEY) ?? COMPANY_VIEW_SENTINEL });
  },

  setProjectRoot: (root) => {
    window.localStorage.setItem(DEFAULT_PROJECT_ROOT_STORAGE_KEY, root);
    set({ projectRoot: root });
  },

  refreshProjects: async () => {
    try {
      const { projects } = await fetchProjects();
      set({ projects });
    } catch {
      // Ingest server unreachable; keep whatever list we already had.
    }
  },
}));

export function currentProjectId(projectRoot: string | null): string | null {
  if (!projectRoot) return null;
  if (projectRoot === COMPANY_VIEW_SENTINEL) return COMPANY_VIEW_SENTINEL;
  return resolveProjectId(projectRoot);
}
