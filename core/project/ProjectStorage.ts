import type { IAuraProject } from "./types";

const STORAGE_KEY = "iaura.projects";

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

export class ProjectStorage {
  save(projects: IAuraProject[]): void {
    if (!canUseStorage()) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(projects),
    );
  }

  load(): IAuraProject[] {
    if (!canUseStorage()) return [];

    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    try {
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

    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export const projectStorage = new ProjectStorage();