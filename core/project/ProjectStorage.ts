import type { IAuraProject } from "./types";

const STORAGE_KEY = "iaura.projects";

function canUseStorage(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export class ProjectStorage {
  save(projects: IAuraProject[]): boolean {
    if (!canUseStorage()) return false;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(projects),
      );
      return true;
    } catch {
      // Keep the in-memory project usable when browser storage is unavailable.
      return false;
    }
  }

  load(): IAuraProject[] {
    if (!canUseStorage()) return [];

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);

      return Array.isArray(parsed)
        ? (parsed as IAuraProject[])
        : [];
    } catch {
      return [];
    }
  }

  clear(): void {
    if (!canUseStorage()) return;

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The in-memory engine remains usable when browser storage is blocked.
    }
  }
}

export const projectStorage = new ProjectStorage();
