import { mergeProjectSnapshots } from "./mergeProjectSnapshots";
import { bootstrapIAuraContinuity } from "./IAuraContinuity";
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
import type {
  IAuraProject,
  ProjectKind,
  ProjectStatus,
  ProjectStudios,
} from "./types";

export const PROJECT_STATE_STORAGE_KEY = "iaura.project-state";
export const LEGACY_PROJECTS_STORAGE_KEY = "iaura.projects";
export const LEGACY_MEMORY_STORAGE_KEY = "iaura-memory";
export const PROJECT_STATE_VERSION = 3;
export const PROJECT_STAGING_STORAGE_KEY = `${PROJECT_STATE_STORAGE_KEY}.staging`;
export const PROJECT_BACKUP_STORAGE_KEY = `${PROJECT_STATE_STORAGE_KEY}.backup`;

export interface ProjectRepositorySnapshot {
  schemaVersion: number;
  activeProjectId: string | null;
  projects: IAuraProject[];
  revision?: number;
  updatedAt?: string;
  writerId?: string;
  migrationCompletedAt?: string;
}

export interface ProjectWriteResult extends StateOperationResult {
  project: IAuraProject;
  persisted: boolean;
  created: boolean;
}

type CurrentProjectState = ProjectRepositorySnapshot & VersionedLocalState;
type ProjectRepositoryListener = () => void;

export interface ProjectRepository {
  getSnapshot(): ProjectRepositorySnapshot;
  getProjects(): IAuraProject[];
  getProject(projectId: string): IAuraProject | null;
  getActiveProject(): IAuraProject | null;
  findEquivalentProject(name: string): IAuraProject | null;
  createProject(project: IAuraProject): ProjectWriteResult;
  updateProject(project: IAuraProject): ProjectWriteResult;
  setActiveProject(project: IAuraProject): ProjectWriteResult;
  setActiveProjectId(projectId: string): boolean;
  setActiveProjectIdResult(projectId: string): StateOperationResult;
  clearActiveProject(): boolean;
  clearActiveProjectResult(): StateOperationResult;
  deleteProject(projectId: string): boolean;
  deleteProjectResult(projectId: string): StateOperationResult;
  replaceSnapshot(snapshot: ProjectRepositorySnapshot): boolean;
  migrateLegacyProject(project: IAuraProject): ProjectWriteResult;
  getRevision(): number;
  getMigrationOutcome(): MigrationOutcome;
  getLastOperationResult(): StateOperationResult;
  replaceSnapshotResult(
    snapshot: ProjectRepositorySnapshot,
    expectedRevision?: number,
  ): StateOperationResult;
  subscribe(listener: ProjectRepositoryListener): () => void;
}

const DEFAULT_STUDIOS: ProjectStudios = {
  branding: false,
  website: false,
  app: false,
  marketing: false,
  documents: false,
};

const PROJECT_STATUSES: ProjectStatus[] = [
  "planning",
  "building",
  "launching",
  "completed",
];

const PROJECT_KINDS: ProjectKind[] = [
  "general",
  "personal",
  "business",
  "creative",
  "learning",
  "wellbeing",
];

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

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function legacyProjectId(name: string): string {
  let hash = 0;
  for (const character of normalizeName(name)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `legacy-project-${hash.toString(36)}`;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeStudios(value: unknown): ProjectStudios {
  if (!isRecord(value)) return { ...DEFAULT_STUDIOS };

  return {
    branding: value.branding === true,
    website: value.website === true,
    app: value.app === true,
    marketing: value.marketing === true,
    documents: value.documents === true,
  };
}

function normalizeProject(value: unknown): IAuraProject | null {
  if (!isRecord(value)) return null;

  const id = stringValue(value.id).trim();
  const name = stringValue(value.name).trim();

  if (!id || !name) return null;

  const createdAt = stringValue(
    value.createdAt,
    "1970-01-01T00:00:00.000Z",
  );
  const updatedAt = stringValue(value.updatedAt, createdAt);
  const status = PROJECT_STATUSES.includes(value.status as ProjectStatus)
    ? (value.status as ProjectStatus)
    : "planning";
  const kind = PROJECT_KINDS.includes(value.kind as ProjectKind)
    ? (value.kind as ProjectKind)
    : undefined;

  return bootstrapIAuraContinuity({
    ...value,
    id,
    name,
    description: stringValue(value.description),
    goal: stringValue(value.goal),
    createdAt,
    updatedAt,
    status,
    kind: kind ?? "general",
    studios: normalizeStudios(value.studios),
  } as IAuraProject);
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

function projectsFrom(value: unknown): IAuraProject[] {
  if (!Array.isArray(value)) return [];
  const projects = value
    .map(normalizeProject)
    .filter((project): project is IAuraProject => project !== null);
  if (projects.length !== value.length) {
    reportStateDiagnostic("project", "IAURA_STATE_CORRUPTED_RECORD_ISOLATED", {
      invalidRecords: value.length - projects.length,
    });
  }
  return projects;
}

function deduplicateProjects(projects: IAuraProject[]): {
  projects: IAuraProject[];
  idAliases: Map<string, string>;
} {
  let deduplicated: IAuraProject[] = [];
  const idAliases = new Map<string, string>();

  for (const project of projects) {
    const merged = addProject(deduplicated, project);
    deduplicated = merged.projects;
    idAliases.set(project.id, merged.projectId);
  }

  return { projects: deduplicated, idAliases };
}

function addProject(
  projects: IAuraProject[],
  candidate: IAuraProject,
): { projects: IAuraProject[]; projectId: string } {
  const exactIndex = projects.findIndex(
    (project) => project.id === candidate.id,
  );
  const equivalentIndex = projects.findIndex(
    (project) => normalizeName(project.name) === normalizeName(candidate.name),
  );
  const index = exactIndex >= 0 ? exactIndex : equivalentIndex;

  if (index < 0) {
    return {
      projects: [...projects, candidate],
      projectId: candidate.id,
    };
  }

  const existing = projects[index];
  const normalizedCandidate =
    candidate.id === existing.id
      ? candidate
      : { ...candidate, id: existing.id };
  const merged = mergeProjectSnapshots(existing, normalizedCandidate);
  const nextProjects = [...projects];
  nextProjects[index] = merged;

  return {
    projects: nextProjects,
    projectId: existing.id,
  };
}

function cloneSnapshot(
  snapshot: ProjectRepositorySnapshot,
): ProjectRepositorySnapshot {
  const projects = snapshot.projects.map((project) => {
    try {
      return structuredClone(project);
    } catch {
      return JSON.parse(JSON.stringify(project)) as IAuraProject;
    }
  });

  return {
    schemaVersion: PROJECT_STATE_VERSION,
    activeProjectId: snapshot.activeProjectId,
    projects,
    ...(typeof snapshot.revision === "number"
      ? {
          revision: snapshot.revision,
          updatedAt: snapshot.updatedAt,
          writerId: snapshot.writerId,
          migrationCompletedAt: snapshot.migrationCompletedAt,
        }
      : {}),
  };
}

function normalizeSnapshot(value: unknown): ProjectRepositorySnapshot | null {
  if (
    !isRecord(value) ||
    ![1, 2, PROJECT_STATE_VERSION].includes(value.schemaVersion as number)
  ) {
    return null;
  }

  const normalized = deduplicateProjects(projectsFrom(value.projects));
  const projects = normalized.projects;
  const requestedActiveId =
    typeof value.activeProjectId === "string"
      ? value.activeProjectId
      : null;

  const activeProjectId = requestedActiveId
    ? normalized.idAliases.get(requestedActiveId) ?? requestedActiveId
    : null;

  return {
    schemaVersion: value.schemaVersion as number,
    activeProjectId: projects.some(
      (project) => project.id === activeProjectId,
    )
      ? activeProjectId
      : null,
    projects,
    ...(value.schemaVersion === PROJECT_STATE_VERSION &&
    typeof value.revision === "number" &&
    Number.isInteger(value.revision) &&
    value.revision >= 0 &&
    typeof value.updatedAt === "string" &&
    typeof value.writerId === "string" &&
    typeof value.migrationCompletedAt === "string"
      ? {
          revision: value.revision,
          updatedAt: value.updatedAt,
          writerId: value.writerId,
          migrationCompletedAt: value.migrationCompletedAt,
        }
      : {}),
  };
}

function normalizeCurrentState(value: unknown): CurrentProjectState | null {
  const normalized = normalizeSnapshot(value);
  if (
    !normalized ||
    normalized.schemaVersion !== PROJECT_STATE_VERSION ||
    typeof normalized.revision !== "number" ||
    !normalized.updatedAt ||
    !normalized.writerId ||
    !normalized.migrationCompletedAt
  ) {
    return null;
  }
  return normalized as CurrentProjectState;
}

function emptyState(writerId: string): CurrentProjectState {
  const now = new Date().toISOString();
  return {
    schemaVersion: PROJECT_STATE_VERSION,
    revision: 0,
    updatedAt: now,
    writerId,
    migrationCompletedAt: now,
    activeProjectId: null,
    projects: [],
  };
}

export class LocalProjectRepository implements ProjectRepository {
  private state: CurrentProjectState;
  private canonicalRaw: string | null = null;
  private migrationOutcome: MigrationOutcome = "failed_safely";
  private lastResult: StateOperationResult;
  private readonly writerId: string;
  private readonly listeners = new Set<ProjectRepositoryListener>();
  private readonly storageListener?: (event: StorageEvent) => void;
  private blockedByFutureVersion = false;

  constructor(options: { synchronize?: boolean; writerId?: string } = {}) {
    this.writerId = options.writerId ?? createWriterId();
    this.state = this.loadAndMigrate();
    this.lastResult = {
      ok: this.migrationOutcome !== "failed_safely",
      outcome:
        this.migrationOutcome === "failed_safely" ? "failed" : "unchanged",
      revision: this.state.revision,
      ...(this.blockedByFutureVersion
        ? { code: "IAURA_STATE_UNSUPPORTED_VERSION" as const }
        : {}),
    };

    if (options.synchronize && typeof window !== "undefined") {
      this.storageListener = (event) => this.handleStorageEvent(event);
      window.addEventListener("storage", this.storageListener);
    }
  }

  private loadAndMigrate(): CurrentProjectState {
    const fallback = emptyState(this.writerId);
    if (!canUseStorage()) return fallback;

    const canonicalRead = readLocalState(PROJECT_STATE_STORAGE_KEY);
    const canonicalValue = parseLocalState(canonicalRead.value);
    const canonicalVersion = schemaVersionOf(canonicalValue);
    if (canonicalVersion !== null && canonicalVersion > PROJECT_STATE_VERSION) {
      this.blockedByFutureVersion = true;
      this.migrationOutcome = "failed_safely";
      reportStateDiagnostic("project", "IAURA_STATE_FUTURE_VERSION_REJECTED", {
        schemaVersion: canonicalVersion,
      });
      return fallback;
    }

    const canonical = normalizeCurrentState(canonicalValue);
    if (canonical) {
      this.canonicalRaw = canonicalRead.value;
      const staged = readLocalState(PROJECT_STAGING_STORAGE_KEY).value;
      if (staged !== null) {
        removeLocalState(PROJECT_STAGING_STORAGE_KEY);
        this.migrationOutcome = "recovered";
        reportStateDiagnostic("project", "IAURA_STATE_MIGRATION_RECOVERED");
      } else {
        this.migrationOutcome = "already_current";
      }
      return canonical;
    }

    const backupRead = readLocalState(PROJECT_BACKUP_STORAGE_KEY);
    const backup = normalizeCurrentState(parseLocalState(backupRead.value));
    const stagedRead = readLocalState(PROJECT_STAGING_STORAGE_KEY);
    const staged = normalizeCurrentState(parseLocalState(stagedRead.value));
    const recovered = backup ?? staged;
    if (recovered) {
      const raw = backup ? backupRead.value : stagedRead.value;
      if (raw && writeLocalState(PROJECT_STATE_STORAGE_KEY, raw)) {
        removeLocalState(PROJECT_STAGING_STORAGE_KEY);
        this.canonicalRaw = raw;
        this.migrationOutcome = "recovered";
        reportStateDiagnostic("project", "IAURA_STATE_LAST_KNOWN_GOOD_RECOVERED", {
          source: backup ? "backup" : "staging",
        });
        return recovered;
      }
    }

    const previous = normalizeSnapshot(canonicalValue);
    let projects = previous?.projects ?? [];
    let activeProjectId = previous?.activeProjectId ?? null;

    const legacyProjects = projectsFrom(
      parseJson(readStorage(LEGACY_PROJECTS_STORAGE_KEY)),
    );
    for (const project of legacyProjects) {
      const merged = addProject(projects, project);
      projects = merged.projects;
    }

    const legacyMemory = parseJson(
      readStorage(LEGACY_MEMORY_STORAGE_KEY),
    );
    const legacyActive = isRecord(legacyMemory)
      ? normalizeProject(legacyMemory.activeProject)
      : null;

    if (legacyActive && isRecord(legacyMemory)) {
      const merged = addProject(projects, legacyActive);
      projects = merged.projects;
      if (!activeProjectId) activeProjectId = merged.projectId;

      const legacyProjectNames = Array.isArray(legacyMemory.projects)
        ? legacyMemory.projects.filter(
            (name): name is string =>
              typeof name === "string" && name.trim().length > 0,
          )
        : [];
      for (const name of legacyProjectNames) {
        const placeholder: IAuraProject = {
          id: legacyProjectId(name),
          name: name.trim(),
          description: "",
          goal: "",
          createdAt: "1970-01-01T00:00:00.000Z",
          updatedAt: "1970-01-01T00:00:00.000Z",
          status: "planning",
          kind: "general",
          studios: { ...DEFAULT_STUDIOS },
        };
        projects = addProject(projects, placeholder).projects;
      }
    }

    if (
      activeProjectId &&
      !projects.some((project) => project.id === activeProjectId)
    ) {
      activeProjectId = null;
    }

    const now = new Date().toISOString();
    const migrated: CurrentProjectState = {
      schemaVersion: PROJECT_STATE_VERSION,
      revision: 1,
      updatedAt: now,
      writerId: this.writerId,
      migrationCompletedAt: now,
      activeProjectId: activeProjectId ?? projects[0]?.id ?? null,
      projects,
    };

    reportStateDiagnostic("project", "IAURA_STATE_MIGRATION_STARTED");
    const write = atomicWriteState({
      scope: "project",
      storageKey: PROJECT_STATE_STORAGE_KEY,
      stagingKey: PROJECT_STAGING_STORAGE_KEY,
      backupKey: PROJECT_BACKUP_STORAGE_KEY,
      expectedCanonicalRaw: canonicalRead.value,
      state: migrated,
      validate: normalizeCurrentState,
    });
    if (write.result.ok) {
      this.canonicalRaw = write.canonicalRaw ?? null;
      this.migrationOutcome = "migrated";
      this.persistLegacyMirror(migrated);
      reportStateDiagnostic("project", "IAURA_STATE_MIGRATION_COMPLETED", {
        revision: migrated.revision,
      });
    } else {
      this.migrationOutcome = "failed_safely";
    }
    return migrated;
  }

  private persistLegacyMirror(snapshot: CurrentProjectState): void {
    try {
      window.localStorage.setItem(
        LEGACY_PROJECTS_STORAGE_KEY,
        JSON.stringify(snapshot.projects),
      );
    } catch {
      // The canonical write succeeded. The legacy mirror remains best-effort.
    }

  }

  private commit(
    snapshot: ProjectRepositorySnapshot,
    expectedRevision = this.state.revision,
  ): StateOperationResult {
    if (this.blockedByFutureVersion) {
      return this.remember({
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_UNSUPPORTED_VERSION",
      });
    }
    if (expectedRevision !== this.state.revision) {
      return this.remember({
        ok: false,
        outcome: "conflict",
        revision: this.state.revision,
        code: "IAURA_STATE_STALE_WRITE",
      });
    }

    const now = new Date().toISOString();
    const candidate = normalizeCurrentState({
      ...snapshot,
      schemaVersion: PROJECT_STATE_VERSION,
      revision: this.state.revision + 1,
      updatedAt: now,
      writerId: this.writerId,
      migrationCompletedAt: this.state.migrationCompletedAt,
    });
    if (!candidate) {
      return this.remember({
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_VALIDATION_FAILED",
      });
    }

    const write = atomicWriteState({
      scope: "project",
      storageKey: PROJECT_STATE_STORAGE_KEY,
      stagingKey: PROJECT_STAGING_STORAGE_KEY,
      backupKey: PROJECT_BACKUP_STORAGE_KEY,
      expectedCanonicalRaw: this.canonicalRaw,
      state: candidate,
      validate: normalizeCurrentState,
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
    const read = readLocalState(PROJECT_STATE_STORAGE_KEY);
    const current = normalizeCurrentState(parseLocalState(read.value));
    if (current) {
      this.state = current;
      this.canonicalRaw = read.value;
      this.notify();
    }
  }

  private handleStorageEvent(event: StorageEvent): void {
    if (event.key !== PROJECT_STATE_STORAGE_KEY || !event.newValue) return;
    const incoming = normalizeCurrentState(parseLocalState(event.newValue));
    if (!incoming) return;
    const newer =
      incoming.revision > this.state.revision ||
      (incoming.revision === this.state.revision &&
        `${incoming.updatedAt}:${incoming.writerId}` >
          `${this.state.updatedAt}:${this.state.writerId}`);
    if (!newer) return;
    this.state = incoming;
    this.canonicalRaw = event.newValue;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  getSnapshot(): ProjectRepositorySnapshot {
    return cloneSnapshot(this.state);
  }

  getProjects(): IAuraProject[] {
    return this.getSnapshot().projects;
  }

  getProject(projectId: string): IAuraProject | null {
    return (
      this.getSnapshot().projects.find(
        (project) => project.id === projectId,
      ) ?? null
    );
  }

  getActiveProject(): IAuraProject | null {
    return this.state.activeProjectId
      ? this.getProject(this.state.activeProjectId)
      : null;
  }

  findEquivalentProject(name: string): IAuraProject | null {
    const normalized = normalizeName(name);
    if (!normalized) return null;

    return (
      this.getProjects().find(
        (project) => normalizeName(project.name) === normalized,
      ) ?? null
    );
  }

  createProject(project: IAuraProject): ProjectWriteResult {
    const equivalent = this.findEquivalentProject(project.name);
    if (equivalent) {
      return {
        project: equivalent,
        persisted: true,
        created: false,
        ok: true,
        outcome: "unchanged",
        revision: this.state.revision,
      };
    }

    const next: ProjectRepositorySnapshot = {
      schemaVersion: PROJECT_STATE_VERSION,
      activeProjectId: project.id,
      projects: [...this.state.projects, project],
    };

    const result = this.commit(next);
    return {
      project,
      ...result,
      persisted: result.ok,
      created: result.ok,
    };
  }

  updateProject(project: IAuraProject): ProjectWriteResult {
    const current = this.getProject(project.id);
    const merged = current
      ? mergeProjectSnapshots(current, project)
      : project;
    const projects = current
      ? this.state.projects.map((candidate) =>
          candidate.id === project.id ? merged : candidate,
        )
      : [...this.state.projects, merged];

    const result = this.commit({ ...this.state, projects });
    return {
      project: merged,
      ...result,
      persisted: result.ok,
      created: result.ok && !current,
    };
  }

  setActiveProject(project: IAuraProject): ProjectWriteResult {
    const existing =
      this.getProject(project.id) ??
      this.findEquivalentProject(project.name);
    const merged = addProject(this.state.projects, project);
    const activeProject = merged.projects.find(
      (candidate) => candidate.id === merged.projectId,
    ) ?? project;
    const result = this.commit({
      schemaVersion: PROJECT_STATE_VERSION,
      activeProjectId: merged.projectId,
      projects: merged.projects,
    });

    return {
      project: activeProject,
      ...result,
      persisted: result.ok,
      created: result.ok && !existing,
    };
  }

  setActiveProjectId(projectId: string): boolean {
    return this.setActiveProjectIdResult(projectId).ok;
  }

  setActiveProjectIdResult(projectId: string): StateOperationResult {
    if (!this.getProject(projectId)) {
      return this.remember({ ok: false, outcome: "failed", revision: this.state.revision, code: "IAURA_STATE_VALIDATION_FAILED" });
    }
    if (this.state.activeProjectId === projectId) {
      return this.remember({ ok: true, outcome: "unchanged", revision: this.state.revision });
    }

    return this.commit({
      ...this.state,
      activeProjectId: projectId,
    });
  }

  clearActiveProject(): boolean {
    return this.clearActiveProjectResult().ok;
  }

  clearActiveProjectResult(): StateOperationResult {
    if (this.state.activeProjectId === null) {
      return this.remember({ ok: true, outcome: "unchanged", revision: this.state.revision });
    }
    return this.commit({ ...this.state, activeProjectId: null });
  }

  deleteProject(projectId: string): boolean {
    return this.deleteProjectResult(projectId).ok;
  }

  deleteProjectResult(projectId: string): StateOperationResult {
    const projects = this.state.projects.filter(
      (project) => project.id !== projectId,
    );
    if (projects.length === this.state.projects.length) {
      return this.remember({ ok: false, outcome: "failed", revision: this.state.revision, code: "IAURA_STATE_VALIDATION_FAILED" });
    }

    return this.commit({
      ...this.state,
      activeProjectId:
        this.state.activeProjectId === projectId
          ? null
          : this.state.activeProjectId,
      projects,
    });
  }

  replaceSnapshot(snapshot: ProjectRepositorySnapshot): boolean {
    return this.replaceSnapshotResult(snapshot).ok;
  }

  replaceSnapshotResult(
    snapshot: ProjectRepositorySnapshot,
    expectedRevision = this.state.revision,
  ): StateOperationResult {
    const normalized = normalizeSnapshot(snapshot);
    if (!normalized) {
      return this.remember({
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_VALIDATION_FAILED",
      });
    }
    return this.commit(normalized, expectedRevision);
  }

  migrateLegacyProject(project: IAuraProject): ProjectWriteResult {
    const normalized = normalizeProject(project);
    if (!normalized) {
      return {
        project,
        persisted: false,
        created: false,
        ok: false,
        outcome: "failed",
        revision: this.state.revision,
        code: "IAURA_STATE_VALIDATION_FAILED",
      };
    }

    const merged = addProject(this.state.projects, normalized);
    const existing = this.getProject(merged.projectId);
    const nextProject = merged.projects.find(
      (candidate) => candidate.id === merged.projectId,
    ) ?? normalized;
    const next: ProjectRepositorySnapshot = {
      schemaVersion: PROJECT_STATE_VERSION,
      activeProjectId: merged.projectId,
      projects: merged.projects,
    };
    const unchanged =
      JSON.stringify(this.state.projects) ===
        JSON.stringify(merged.projects) &&
      this.state.activeProjectId === merged.projectId;

    const result = unchanged
      ? this.remember({
          ok: true,
          outcome: "unchanged",
          revision: this.state.revision,
        })
      : this.commit(next);
    return {
      project: nextProject,
      ...result,
      persisted: result.ok,
      created: result.ok && !existing,
    };
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

  subscribe(listener: ProjectRepositoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (this.storageListener && typeof window !== "undefined") {
      window.removeEventListener("storage", this.storageListener);
    }
    this.listeners.clear();
  }
}

export const projectRepository = new LocalProjectRepository({ synchronize: true });
