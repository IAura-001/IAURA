import { DEFAULT_MEMORY } from "@/constants/memory";
import { normalizeLocale } from "@/core/i18n/languages";
import {
  LocalProjectRepository,
  projectRepository,
  type ProjectRepository,
} from "@/core/project/ProjectRepository";
import type { IAuraProject } from "@/types/project";
import type { Memory } from "@/types/memory";
import {
  atomicWriteState,
  createWriterId,
  parseLocalState,
  readLocalState,
  removeLocalState,
  reportStateDiagnostic,
  schemaVersionOf,
  writeLocalState,
  type MigrationOutcome,
  type StateOperationResult,
  type VersionedLocalState,
} from "@/core/storage/StateReliability";

import type { MemoryEntry } from "./MemoryTypes";
import { MemoryType } from "./MemoryTypes";

export const MEMORY_STATE_STORAGE_KEY = "iaura.memory-state";
export const LEGACY_MEMORY_STORAGE_KEY = "iaura-memory";
export const MEMORY_STATE_VERSION = 2;
export const MEMORY_STAGING_STORAGE_KEY = `${MEMORY_STATE_STORAGE_KEY}.staging`;
export const MEMORY_BACKUP_STORAGE_KEY = `${MEMORY_STATE_STORAGE_KEY}.backup`;

export interface MemoryRepositorySnapshot {
  schemaVersion: number;
  memory: Memory;
  entries: MemoryEntry[];
  revision?: number;
  updatedAt?: string;
  writerId?: string;
  migrationCompletedAt?: string;
}

type StoredMemoryState = MemoryRepositorySnapshot & VersionedLocalState;
type MemoryRepositoryListener = () => void;

export interface MemoryRepository {
  getMemory(): Memory;
  saveMemory(memory: Memory): boolean;
  getEntries(): MemoryEntry[];
  upsertEntry(entry: MemoryEntry): boolean;
  upsertEntryResult(entry: MemoryEntry): StateOperationResult;
  clearMemory(): boolean;
  clearMemoryResult(): StateOperationResult;
  getSnapshot(): MemoryRepositorySnapshot;
  getRevision(): number;
  getMigrationOutcome(): MigrationOutcome;
  getLastOperationResult(): StateOperationResult;
  saveMemoryResult(memory: Memory, expectedRevision?: number): StateOperationResult;
  replaceSnapshotResult(
    snapshot: MemoryRepositorySnapshot,
    expectedRevision?: number,
  ): StateOperationResult;
  subscribe(listener: MemoryRepositoryListener): () => void;
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
  if (
    !isRecord(value) ||
    value.schemaVersion !== MEMORY_STATE_VERSION ||
    typeof value.revision !== "number" ||
    !Number.isInteger(value.revision) ||
    value.revision < 0 ||
    typeof value.updatedAt !== "string" ||
    typeof value.writerId !== "string" ||
    typeof value.migrationCompletedAt !== "string"
  ) {
    return null;
  }

  const rawEntries = Array.isArray(value.entries) ? value.entries : [];
  const entries = Array.isArray(value.entries)
    ? value.entries
        .map(normalizeEntry)
        .filter((entry): entry is MemoryEntry => entry !== null)
    : [];
  if (entries.length !== rawEntries.length) {
    reportStateDiagnostic("memory", "IAURA_STATE_CORRUPTED_RECORD_ISOLATED", {
      invalidRecords: rawEntries.length - entries.length,
    });
  }

  return {
    schemaVersion: MEMORY_STATE_VERSION,
    revision: value.revision,
    updatedAt: value.updatedAt,
    writerId: value.writerId,
    migrationCompletedAt: value.migrationCompletedAt,
    memory: normalizeMemory(value.memory),
    entries,
  };
}

function normalizeLegacyState(value: unknown): MemoryRepositorySnapshot | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  return {
    schemaVersion: 1,
    memory: normalizeMemory(value.memory),
    entries: Array.isArray(value.entries)
      ? value.entries
          .map(normalizeEntry)
          .filter((entry): entry is MemoryEntry => entry !== null)
      : [],
  };
}

function cloneState(state: MemoryRepositorySnapshot): MemoryRepositorySnapshot {
  return {
    ...state,
    memory: cloneMemory(state.memory),
    entries: state.entries.map((entry) => ({ ...entry, tags: [...entry.tags] })),
  };
}

export class LocalMemoryRepository implements MemoryRepository {
  private state: StoredMemoryState;
  private canonicalRaw: string | null = null;
  private migrationOutcome: MigrationOutcome = "failed_safely";
  private lastResult: StateOperationResult;
  private readonly writerId: string;
  private readonly listeners = new Set<MemoryRepositoryListener>();
  private readonly storageListener?: (event: StorageEvent) => void;
  private readonly unsubscribeProjects?: () => void;
  private blockedByFutureVersion = false;

  constructor(
    private readonly projects: ProjectRepository =
      new LocalProjectRepository(),
    options: { synchronize?: boolean; writerId?: string } = {},
  ) {
    this.writerId = options.writerId ?? createWriterId();
    this.state = this.loadAndMigrate();
    this.lastResult = {
      ok: this.migrationOutcome !== "failed_safely",
      outcome: this.migrationOutcome === "failed_safely" ? "failed" : "unchanged",
      revision: this.state.revision,
      ...(this.blockedByFutureVersion
        ? { code: "IAURA_STATE_UNSUPPORTED_VERSION" as const }
        : {}),
    };
    this.unsubscribeProjects = this.projects.subscribe(() => {
      const synchronized: Memory = {
        ...this.state.memory,
        projects: this.projects.getProjects().map((project) => project.name),
        activeProject: this.projects.getActiveProject(),
      };
      if (JSON.stringify(synchronized) !== JSON.stringify(this.state.memory)) {
        this.state = { ...this.state, memory: synchronized };
        this.notify();
      }
    });
    if (options.synchronize && typeof window !== "undefined") {
      this.storageListener = (event) => this.handleStorageEvent(event);
      window.addEventListener("storage", this.storageListener);
    }
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
    const now = new Date().toISOString();
    const fallback: StoredMemoryState = {
      schemaVersion: MEMORY_STATE_VERSION,
      revision: 0,
      updatedAt: now,
      writerId: this.writerId,
      migrationCompletedAt: now,
      memory: defaultMemory(),
      entries: [],
    };
    if (!canUseStorage()) {
      return fallback;
    }

    const canonicalRead = readLocalState(MEMORY_STATE_STORAGE_KEY);
    const canonicalValue = parseLocalState(canonicalRead.value);
    const version = schemaVersionOf(canonicalValue);
    if (version !== null && version > MEMORY_STATE_VERSION) {
      this.blockedByFutureVersion = true;
      reportStateDiagnostic("memory", "IAURA_STATE_FUTURE_VERSION_REJECTED", {
        schemaVersion: version,
      });
      return fallback;
    }
    const canonical = normalizeState(canonicalValue);
    if (canonical) {
      this.canonicalRaw = canonicalRead.value;
      if (readLocalState(MEMORY_STAGING_STORAGE_KEY).value !== null) {
        removeLocalState(MEMORY_STAGING_STORAGE_KEY);
        this.migrationOutcome = "recovered";
        reportStateDiagnostic("memory", "IAURA_STATE_MIGRATION_RECOVERED");
      } else {
        this.migrationOutcome = "already_current";
      }
      return {
        ...canonical,
        memory: this.synchronizeProjectState(canonical.memory).memory,
      };
    }

    const backupRead = readLocalState(MEMORY_BACKUP_STORAGE_KEY);
    const backup = normalizeState(parseLocalState(backupRead.value));
    const stagedRead = readLocalState(MEMORY_STAGING_STORAGE_KEY);
    const staged = normalizeState(parseLocalState(stagedRead.value));
    const recovered = backup ?? staged;
    if (recovered) {
      const raw = backup ? backupRead.value : stagedRead.value;
      if (raw && writeLocalState(MEMORY_STATE_STORAGE_KEY, raw)) {
        removeLocalState(MEMORY_STAGING_STORAGE_KEY);
        this.canonicalRaw = raw;
        this.migrationOutcome = "recovered";
        reportStateDiagnostic("memory", "IAURA_STATE_LAST_KNOWN_GOOD_RECOVERED", {
          source: backup ? "backup" : "staging",
        });
        return {
          ...recovered,
          memory: this.synchronizeProjectState(recovered.memory).memory,
        };
      }
    }

    const previous = normalizeLegacyState(canonicalValue);
    const legacyMemory = normalizeMemory(
      parseJson(readStorage(LEGACY_MEMORY_STORAGE_KEY)),
    );
    const { memory } = this.synchronizeProjectState(
      previous?.memory ?? legacyMemory,
    );
    const state: StoredMemoryState = {
      schemaVersion: MEMORY_STATE_VERSION,
      revision: 1,
      updatedAt: now,
      writerId: this.writerId,
      migrationCompletedAt: now,
      memory,
      entries: previous?.entries ?? [],
    };
    reportStateDiagnostic("memory", "IAURA_STATE_MIGRATION_STARTED");
    const write = atomicWriteState({
      scope: "memory",
      storageKey: MEMORY_STATE_STORAGE_KEY,
      stagingKey: MEMORY_STAGING_STORAGE_KEY,
      backupKey: MEMORY_BACKUP_STORAGE_KEY,
      expectedCanonicalRaw: canonicalRead.value,
      state,
      validate: normalizeState,
    });
    if (write.result.ok) {
      this.canonicalRaw = write.canonicalRaw ?? null;
      this.migrationOutcome = "migrated";
      this.persistLegacyMirror(state);
      reportStateDiagnostic("memory", "IAURA_STATE_MIGRATION_COMPLETED", {
        revision: state.revision,
      });
    }
    return state;
  }

  private persistLegacyMirror(state: StoredMemoryState): void {
    try {
      window.localStorage.setItem(
        LEGACY_MEMORY_STORAGE_KEY,
        JSON.stringify(state.memory),
      );
    } catch {
      // The versioned source was persisted; the legacy mirror is best-effort.
    }

  }

  private commit(
    snapshot: MemoryRepositorySnapshot,
    expectedRevision = this.state.revision,
  ): StateOperationResult {
    if (this.blockedByFutureVersion) {
      return this.remember({ ok: false, outcome: "failed", revision: this.state.revision, code: "IAURA_STATE_UNSUPPORTED_VERSION" });
    }
    if (expectedRevision !== this.state.revision) {
      return this.remember({ ok: false, outcome: "conflict", revision: this.state.revision, code: "IAURA_STATE_STALE_WRITE" });
    }
    const candidate = normalizeState({
      ...snapshot,
      schemaVersion: MEMORY_STATE_VERSION,
      revision: this.state.revision + 1,
      updatedAt: new Date().toISOString(),
      writerId: this.writerId,
      migrationCompletedAt: this.state.migrationCompletedAt,
    });
    if (!candidate) {
      return this.remember({ ok: false, outcome: "failed", revision: this.state.revision, code: "IAURA_STATE_VALIDATION_FAILED" });
    }
    const write = atomicWriteState({
      scope: "memory",
      storageKey: MEMORY_STATE_STORAGE_KEY,
      stagingKey: MEMORY_STAGING_STORAGE_KEY,
      backupKey: MEMORY_BACKUP_STORAGE_KEY,
      expectedCanonicalRaw: this.canonicalRaw,
      state: candidate,
      validate: normalizeState,
    });
    if (!write.result.ok) {
      if (write.result.outcome === "conflict") this.refreshCanonical();
      return this.remember(write.result);
    }
    this.state = candidate;
    this.canonicalRaw = write.canonicalRaw ?? null;
    this.persistLegacyMirror(candidate);
    this.notify();
    return this.remember(write.result);
  }

  private remember(result: StateOperationResult): StateOperationResult {
    this.lastResult = result;
    return result;
  }

  private refreshCanonical(): void {
    const read = readLocalState(MEMORY_STATE_STORAGE_KEY);
    const current = normalizeState(parseLocalState(read.value));
    if (!current) return;
    this.state = current;
    this.canonicalRaw = read.value;
    this.notify();
  }

  private handleStorageEvent(event: StorageEvent): void {
    if (event.key !== MEMORY_STATE_STORAGE_KEY || !event.newValue) return;
    const incoming = normalizeState(parseLocalState(event.newValue));
    if (!incoming) return;
    const newer = incoming.revision > this.state.revision ||
      (incoming.revision === this.state.revision &&
        `${incoming.updatedAt}:${incoming.writerId}` > `${this.state.updatedAt}:${this.state.writerId}`);
    if (!newer) return;
    this.state = incoming;
    this.canonicalRaw = event.newValue;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  getMemory(): Memory {
    return cloneMemory(this.state.memory);
  }

  saveMemory(memory: Memory): boolean {
    return this.saveMemoryResult(memory).ok;
  }

  saveMemoryResult(
    memory: Memory,
    expectedRevision = this.state.revision,
  ): StateOperationResult {
    const synchronized = this.synchronizeProjectState(
      normalizeMemory(memory),
    );
    if (!synchronized.projectPersistenceSucceeded) {
      return this.remember({ ok: false, outcome: "failed", revision: this.state.revision, code: "IAURA_STATE_PERSISTENCE_FAILED" });
    }

    const next: StoredMemoryState = {
      ...this.state,
      memory: synchronized.memory,
    };
    return this.commit(next, expectedRevision);
  }

  getEntries(): MemoryEntry[] {
    return this.state.entries.map((entry) => ({
      ...entry,
      tags: [...entry.tags],
    }));
  }

  upsertEntry(entry: MemoryEntry): boolean {
    return this.upsertEntryResult(entry).ok;
  }

  upsertEntryResult(entry: MemoryEntry): StateOperationResult {
    const normalized = normalizeEntry(entry);
    if (!normalized) {
      return this.remember({ ok: false, outcome: "failed", revision: this.state.revision, code: "IAURA_STATE_VALIDATION_FAILED" });
    }

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
    return this.commit(next);
  }

  clearMemory(): boolean {
    return this.clearMemoryResult().ok;
  }

  clearMemoryResult(): StateOperationResult {
    const next: StoredMemoryState = {
      ...this.state,
      schemaVersion: MEMORY_STATE_VERSION,
      memory: this.synchronizeProjectState(defaultMemory()).memory,
      entries: [],
    };
    return this.commit(next);
  }

  getSnapshot(): MemoryRepositorySnapshot {
    return cloneState(this.state);
  }

  getRevision(): number {
    return this.state.revision;
  }

  getMigrationOutcome(): MigrationOutcome {
    return this.migrationOutcome;
  }

  getLastOperationResult(): StateOperationResult {
    return { ...this.lastResult };
  }

  replaceSnapshotResult(
    snapshot: MemoryRepositorySnapshot,
    expectedRevision = this.state.revision,
  ): StateOperationResult {
    if (!isRecord(snapshot) || !Array.isArray(snapshot.entries)) {
      return this.remember({ ok: false, outcome: "failed", revision: this.state.revision, code: "IAURA_STATE_VALIDATION_FAILED" });
    }
    return this.commit({
      ...snapshot,
      memory: normalizeMemory(snapshot.memory),
      entries: snapshot.entries
        .map(normalizeEntry)
        .filter((entry): entry is MemoryEntry => entry !== null),
    }, expectedRevision);
  }

  subscribe(listener: MemoryRepositoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.unsubscribeProjects?.();
    if (this.storageListener && typeof window !== "undefined") {
      window.removeEventListener("storage", this.storageListener);
    }
    this.listeners.clear();
  }
}

export const memoryRepository = new LocalMemoryRepository(projectRepository, {
  synchronize: true,
});
