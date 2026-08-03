import { DEFAULT_MEMORY } from "@/constants/memory";
import { normalizeLocale } from "@/core/i18n/languages";
import {
  LocalProjectRepository,
  projectRepository,
  type ProjectRepository,
} from "@/core/project/ProjectRepository";
import type { IAuraProject } from "@/types/project";
import type { Memory } from "@/types/memory";

import type { MemoryEntry } from "./MemoryTypes";
import { MemoryType } from "./MemoryTypes";

export const MEMORY_STATE_STORAGE_KEY = "iaura.memory-state";
export const LEGACY_MEMORY_STORAGE_KEY = "iaura-memory";
export const MEMORY_STATE_VERSION = 1;

interface StoredMemoryState {
  schemaVersion: typeof MEMORY_STATE_VERSION;
  memory: Memory;
  entries: MemoryEntry[];
}

export interface MemoryRepository {
  getMemory(): Memory;
  saveMemory(memory: Memory): boolean;
  getEntries(): MemoryEntry[];
  upsertEntry(entry: MemoryEntry): boolean;
  clearMemory(): boolean;
}

function canUseStorage(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeActiveProject(value: unknown): IAuraProject | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.name !== "string" ||
    !value.name.trim()
  ) {
    return null;
  }

  return value as unknown as IAuraProject;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeEntry(value: unknown): MemoryEntry | null {
  if (!isRecord(value)) return null;

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const content =
    typeof value.content === "string" ? value.content.trim() : "";
  const validType = Object.values(MemoryType).includes(
    value.type as MemoryType,
  );

  if (!id || !content || !validType) return null;

  return {
    id,
    content,
    type: value.type as MemoryType,
    tags: stringArray(value.tags),
    importance:
      typeof value.importance === "number" &&
      Number.isFinite(value.importance)
        ? value.importance
        : 0,
    createdAt:
      typeof value.createdAt === "number" &&
      Number.isFinite(value.createdAt)
        ? value.createdAt
        : 0,
    updatedAt:
      typeof value.updatedAt === "number" &&
      Number.isFinite(value.updatedAt)
        ? value.updatedAt
        : 0,
  };
}

function cloneMemory(memory: Memory): Memory {
  let activeProject: IAuraProject | null = null;
  if (memory.activeProject) {
    try {
      activeProject = structuredClone(memory.activeProject);
    } catch {
      activeProject = JSON.parse(
        JSON.stringify(memory.activeProject),
      ) as IAuraProject;
    }
  }

  return {
    ...memory,
    goals: [...memory.goals],
    habits: [...memory.habits],
    projects: [...memory.projects],
    completedMissionIds: [...memory.completedMissionIds],
    activeProject,
  };
}

function defaultMemory(): Memory {
  return cloneMemory(DEFAULT_MEMORY);
}

function normalizeMemory(value: unknown): Memory {
  if (!isRecord(value)) return defaultMemory();

  const locale =
    typeof value.preferredLocale === "string"
      ? value.preferredLocale
      : DEFAULT_MEMORY.preferredLocale;

  return {
    ...DEFAULT_MEMORY,
    ...value,
    id: typeof value.id === "string" ? value.id : DEFAULT_MEMORY.id,
    userName:
      typeof value.userName === "string"
        ? value.userName
        : DEFAULT_MEMORY.userName,
    preferredLocale: normalizeLocale(locale),
    goals: stringArray(value.goals),
    habits: stringArray(value.habits),
    projects: stringArray(value.projects),
    activeProject: normalizeActiveProject(value.activeProject),
    completedMissions: finiteNumber(
      value.completedMissions,
      DEFAULT_MEMORY.completedMissions,
    ),
    completedMissionIds: stringArray(value.completedMissionIds),
    streak: finiteNumber(value.streak, DEFAULT_MEMORY.streak),
    level: finiteNumber(value.level, DEFAULT_MEMORY.level),
    experience: finiteNumber(
      value.experience,
      DEFAULT_MEMORY.experience,
    ),
    lastLogin:
      typeof value.lastLogin === "string"
        ? value.lastLogin
        : DEFAULT_MEMORY.lastLogin,
  } as Memory;
}

function normalizeState(value: unknown): StoredMemoryState | null {
  if (!isRecord(value) || value.schemaVersion !== MEMORY_STATE_VERSION) {
    return null;
  }

  const entries = Array.isArray(value.entries)
    ? value.entries
        .map(normalizeEntry)
        .filter((entry): entry is MemoryEntry => entry !== null)
    : [];

  return {
    schemaVersion: MEMORY_STATE_VERSION,
    memory: normalizeMemory(value.memory),
    entries,
  };
}

export class LocalMemoryRepository implements MemoryRepository {
  private state: StoredMemoryState;

  constructor(
    private readonly projects: ProjectRepository =
      new LocalProjectRepository(),
  ) {
    this.state = this.loadAndMigrate();
  }

  private synchronizeProjectState(memory: Memory): {
    memory: Memory;
    projectPersistenceSucceeded: boolean;
  } {
    let projectPersistenceSucceeded = true;

    if (!this.projects.getActiveProject() && memory.activeProject) {
      const existing =
        this.projects.getProject(memory.activeProject.id) ??
        this.projects.findEquivalentProject(memory.activeProject.name);

      if (existing) {
        projectPersistenceSucceeded =
          this.projects.setActiveProjectId(existing.id);
      } else {
        projectPersistenceSucceeded =
          this.projects.migrateLegacyProject(
            memory.activeProject,
          ).persisted;
      }
    }

    const activeProject = this.projects.getActiveProject();
    const projectNames = this.projects
      .getProjects()
      .map((project) => project.name);

    return {
      memory: {
        ...memory,
        projects: Array.from(new Set([...memory.projects, ...projectNames])),
        activeProject,
      },
      projectPersistenceSucceeded,
    };
  }

  private loadAndMigrate(): StoredMemoryState {
    if (!canUseStorage()) {
      return {
        schemaVersion: MEMORY_STATE_VERSION,
        memory: defaultMemory(),
        entries: [],
      };
    }

    const canonical = normalizeState(
      parseJson(readStorage(MEMORY_STATE_STORAGE_KEY)),
    );
    const legacyMemory = normalizeMemory(
      parseJson(readStorage(LEGACY_MEMORY_STORAGE_KEY)),
    );
    const { memory } = this.synchronizeProjectState(
      canonical?.memory ?? legacyMemory,
    );
    const state: StoredMemoryState = {
      schemaVersion: MEMORY_STATE_VERSION,
      memory,
      entries: canonical?.entries ?? [],
    };

    this.persist(state);
    return state;
  }

  private persist(state: StoredMemoryState): boolean {
    if (!canUseStorage()) return false;

    try {
      window.localStorage.setItem(
        MEMORY_STATE_STORAGE_KEY,
        JSON.stringify(state),
      );
    } catch {
      return false;
    }

    try {
      window.localStorage.setItem(
        LEGACY_MEMORY_STORAGE_KEY,
        JSON.stringify(state.memory),
      );
    } catch {
      // The versioned source was persisted; the legacy mirror is best-effort.
    }

    return true;
  }

  getMemory(): Memory {
    return cloneMemory(this.state.memory);
  }

  saveMemory(memory: Memory): boolean {
    const synchronized = this.synchronizeProjectState(
      normalizeMemory(memory),
    );
    if (!synchronized.projectPersistenceSucceeded) return false;

    const next: StoredMemoryState = {
      ...this.state,
      memory: synchronized.memory,
    };
    const persisted = this.persist(next);
    this.state = next;
    return persisted;
  }

  getEntries(): MemoryEntry[] {
    return this.state.entries.map((entry) => ({
      ...entry,
      tags: [...entry.tags],
    }));
  }

  upsertEntry(entry: MemoryEntry): boolean {
    const normalized = normalizeEntry(entry);
    if (!normalized) return false;

    const existingIndex = this.state.entries.findIndex(
      (candidate) => candidate.id === normalized.id,
    );
    const entries = [...this.state.entries];

    if (existingIndex >= 0) {
      entries[existingIndex] = normalized;
    } else {
      entries.push(normalized);
    }

    const next = { ...this.state, entries };
    const persisted = this.persist(next);
    this.state = next;
    return persisted;
  }

  clearMemory(): boolean {
    const next: StoredMemoryState = {
      schemaVersion: MEMORY_STATE_VERSION,
      memory: this.synchronizeProjectState(defaultMemory()).memory,
      entries: [],
    };
    const persisted = this.persist(next);
    this.state = next;
    return persisted;
  }
}

export const memoryRepository = new LocalMemoryRepository(projectRepository);
