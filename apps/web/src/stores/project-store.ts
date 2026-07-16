import { create } from "zustand";
import { DEFAULT_PROJECT_ROOT_STORAGE_KEY } from "@/lib/constants";
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
    set({ projectRoot: window.localStorage.getItem(DEFAULT_PROJECT_ROOT_STORAGE_KEY) ?? "" });
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
  return projectRoot ? resolveProjectId(projectRoot) : null;
}
