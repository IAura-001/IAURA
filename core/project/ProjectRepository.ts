import { mergeProjectSnapshots } from "./mergeProjectSnapshots";
import type {
  IAuraProject,
  ProjectKind,
  ProjectStatus,
  ProjectStudios,
} from "./types";

export const PROJECT_STATE_STORAGE_KEY = "iaura.project-state";
export const LEGACY_PROJECTS_STORAGE_KEY = "iaura.projects";
export const LEGACY_MEMORY_STORAGE_KEY = "iaura-memory";
export const PROJECT_STATE_VERSION = 1;

export interface ProjectRepositorySnapshot {
  schemaVersion: typeof PROJECT_STATE_VERSION;
  activeProjectId: string | null;
  projects: IAuraProject[];
}

export interface ProjectWriteResult {
  project: IAuraProject;
  persisted: boolean;
  created: boolean;
}

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
  clearActiveProject(): boolean;
  deleteProject(projectId: string): boolean;
  replaceSnapshot(snapshot: ProjectRepositorySnapshot): boolean;
  migrateLegacyProject(project: IAuraProject): ProjectWriteResult;
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

  return {
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
  } as IAuraProject;
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

  return value
    .map(normalizeProject)
    .filter((project): project is IAuraProject => project !== null);
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
  };
}

function normalizeSnapshot(value: unknown): ProjectRepositorySnapshot | null {
  if (!isRecord(value) || value.schemaVersion !== PROJECT_STATE_VERSION) {
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
    schemaVersion: PROJECT_STATE_VERSION,
    activeProjectId: projects.some(
      (project) => project.id === activeProjectId,
    )
      ? activeProjectId
      : null,
    projects,
  };
}

export class LocalProjectRepository implements ProjectRepository {
  private state: ProjectRepositorySnapshot;

  constructor() {
    this.state = this.loadAndMigrate();
  }

  private loadAndMigrate(): ProjectRepositorySnapshot {
    if (!canUseStorage()) {
      return {
        schemaVersion: PROJECT_STATE_VERSION,
        activeProjectId: null,
        projects: [],
      };
    }

    const canonical = normalizeSnapshot(
      parseJson(readStorage(PROJECT_STATE_STORAGE_KEY)),
    );
    let projects = canonical?.projects ?? [];
    let activeProjectId = canonical?.activeProjectId ?? null;

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

    const migrated: ProjectRepositorySnapshot = {
      schemaVersion: PROJECT_STATE_VERSION,
      activeProjectId: activeProjectId ?? projects[0]?.id ?? null,
      projects,
    };

    this.persist(migrated);
    return migrated;
  }

  private persist(snapshot: ProjectRepositorySnapshot): boolean {
    if (!canUseStorage()) return false;

    try {
      window.localStorage.setItem(
        PROJECT_STATE_STORAGE_KEY,
        JSON.stringify(snapshot),
      );
    } catch {
      return false;
    }

    try {
      window.localStorage.setItem(
        LEGACY_PROJECTS_STORAGE_KEY,
        JSON.stringify(snapshot.projects),
      );
    } catch {
      // The canonical write succeeded. The legacy mirror remains best-effort.
    }

    return true;
  }

  private commit(snapshot: ProjectRepositorySnapshot): boolean {
    const persisted = this.persist(snapshot);
    this.state = cloneSnapshot(snapshot);
    return persisted;
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
      return { project: equivalent, persisted: true, created: false };
    }

    const next: ProjectRepositorySnapshot = {
      schemaVersion: PROJECT_STATE_VERSION,
      activeProjectId: project.id,
      projects: [...this.state.projects, project],
    };

    return {
      project,
      persisted: this.commit(next),
      created: true,
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

    return {
      project: merged,
      persisted: this.commit({ ...this.state, projects }),
      created: !current,
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
    const persisted = this.commit({
      schemaVersion: PROJECT_STATE_VERSION,
      activeProjectId: merged.projectId,
      projects: merged.projects,
    });

    return {
      project: activeProject,
      persisted,
      created: !existing,
    };
  }

  setActiveProjectId(projectId: string): boolean {
    if (!this.getProject(projectId)) return false;
    if (this.state.activeProjectId === projectId) return true;

    return this.commit({
      ...this.state,
      activeProjectId: projectId,
    });
  }

  clearActiveProject(): boolean {
    return this.commit({ ...this.state, activeProjectId: null });
  }

  deleteProject(projectId: string): boolean {
    const projects = this.state.projects.filter(
      (project) => project.id !== projectId,
    );
    if (projects.length === this.state.projects.length) return false;

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
    const normalized = normalizeSnapshot(snapshot);
    if (!normalized) return false;
    return this.commit(normalized);
  }

  migrateLegacyProject(project: IAuraProject): ProjectWriteResult {
    const normalized = normalizeProject(project);
    if (!normalized) {
      return { project, persisted: false, created: false };
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

    return {
      project: nextProject,
      persisted: unchanged ? true : this.commit(next),
      created: !existing,
    };
  }
}

export const projectRepository = new LocalProjectRepository();
