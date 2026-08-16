import type { MigrationOutcome, StateOperationResult } from "@/core/storage/StateReliability";
import { PROJECT_STATE_VERSION, normalizeProject, type ProjectRepository, type ProjectRepositorySnapshot, type ProjectWriteResult } from "./ProjectRepository";
import type { IAuraProject } from "./types";

type Listener = () => void;

const clone = <T,>(value: T): T => structuredClone(value);

export class AuthenticatedProjectRepository implements ProjectRepository {
  private userId: string | null = null;
  private projects: IAuraProject[] = [];
  private activeProjectId: string | null = null;
  private revision = 0;
  private listeners = new Set<Listener>();
  private pending: Promise<void> = Promise.resolve();
  private lastResult: StateOperationResult = { ok: true, outcome: "unchanged", revision: 0 };

  configure(userId: string, projects: IAuraProject[]): void {
    if (this.userId === userId && this.revision > 0) return;
    this.userId = userId;
    this.projects = projects.map(normalizeProject).filter((value): value is IAuraProject => Boolean(value));
    this.activeProjectId = null;
    this.revision += 1;
    this.notify();
  }

  reset(): void {
    this.userId = null;
    this.projects = [];
    this.activeProjectId = null;
    this.revision += 1;
    this.notify();
  }

  async flush(): Promise<void> { await this.pending; }

  private queue(method: "POST" | "PUT" | "DELETE", project?: IAuraProject, projectId?: string): void {
    const scopedUser = this.userId;
    const path = projectId ? `/api/projects/${encodeURIComponent(projectId)}` : "/api/projects";
    this.pending = this.pending.catch(() => undefined).then(async () => {
      if (!scopedUser || scopedUser !== this.userId) return;
      const response = await fetch(path, {
        method,
        headers: project ? { "Content-Type": "application/json" } : undefined,
        body: project ? JSON.stringify({ project }) : undefined,
      });
      if (!response.ok) throw new Error(`Project persistence failed (${response.status}).`);
    }).catch(() => {
      this.lastResult = { ok: false, outcome: "failed", revision: this.revision, code: "IAURA_STATE_PERSISTENCE_FAILED" };
      this.notify();
    });
  }

  private result(ok = true, outcome: StateOperationResult["outcome"] = "committed"): StateOperationResult {
    this.revision += ok ? 1 : 0;
    return (this.lastResult = { ok, outcome, revision: this.revision });
  }

  private write(project: IAuraProject, created: boolean): ProjectWriteResult {
    const normalized = normalizeProject(project);
    if (!normalized || !this.userId) return { project, persisted: false, created: false, ...this.result(false, "failed") };
    const index = this.projects.findIndex((item) => item.id === normalized.id);
    if (index >= 0 && JSON.stringify(this.projects[index]) === JSON.stringify(normalized)) {
      this.activeProjectId = normalized.id;
      return { project: clone(normalized), persisted: true, created: false, ...this.result(true, "unchanged") };
    }
    if (index >= 0) this.projects[index] = normalized; else this.projects.push(normalized);
    this.activeProjectId = normalized.id;
    this.queue(index >= 0 ? "PUT" : "POST", normalized, index >= 0 ? normalized.id : undefined);
    this.notify();
    return { project: clone(normalized), persisted: true, created, ...this.result() };
  }

  getSnapshot(): ProjectRepositorySnapshot { return { schemaVersion: PROJECT_STATE_VERSION, activeProjectId: this.activeProjectId, projects: clone(this.projects), revision: this.revision }; }
  getProjects(): IAuraProject[] { return clone(this.projects); }
  getProject(id: string): IAuraProject | null { const found = this.projects.find((p) => p.id === id); return found ? clone(found) : null; }
  getActiveProject(): IAuraProject | null { return this.activeProjectId ? this.getProject(this.activeProjectId) : null; }
  findEquivalentProject(name: string): IAuraProject | null { const key = name.trim().toLocaleLowerCase(); const found = this.projects.find((p) => p.name.trim().toLocaleLowerCase() === key); return found ? clone(found) : null; }
  createProject(project: IAuraProject): ProjectWriteResult { return this.write(project, !this.projects.some((p) => p.id === project.id)); }
  updateProject(project: IAuraProject): ProjectWriteResult { return this.write(project, false); }
  setActiveProject(project: IAuraProject): ProjectWriteResult { const exists = this.projects.some((p) => p.id === project.id); return this.write(project, !exists); }
  setActiveProjectId(id: string): boolean { return this.setActiveProjectIdResult(id).ok; }
  setActiveProjectIdResult(id: string): StateOperationResult { if (!this.projects.some((p) => p.id === id)) return this.result(false, "failed"); this.activeProjectId = id; this.notify(); return this.result(true, "unchanged"); }
  clearActiveProject(): boolean { return this.clearActiveProjectResult().ok; }
  clearActiveProjectResult(): StateOperationResult { this.activeProjectId = null; this.notify(); return this.result(true, "unchanged"); }
  deleteProject(id: string): boolean { return this.deleteProjectResult(id).ok; }
  deleteProjectResult(id: string): StateOperationResult { const before = this.projects.length; this.projects = this.projects.filter((p) => p.id !== id); if (before === this.projects.length) return this.result(false, "failed"); if (this.activeProjectId === id) this.activeProjectId = null; this.queue("DELETE", undefined, id); this.notify(); return this.result(); }
  replaceSnapshot(snapshot: ProjectRepositorySnapshot): boolean { return this.replaceSnapshotResult(snapshot).ok; }
  replaceSnapshotResult(snapshot: ProjectRepositorySnapshot): StateOperationResult { const normalized = snapshot.projects.map(normalizeProject); if (normalized.some((p) => !p)) return this.result(false, "failed"); this.projects = normalized as IAuraProject[]; this.activeProjectId = snapshot.activeProjectId; for (const project of this.projects) this.queue("PUT", project, project.id); this.notify(); return this.result(); }
  migrateLegacyProject(project: IAuraProject): ProjectWriteResult { return this.write(project, !this.projects.some((p) => p.id === project.id)); }
  getRevision(): number { return this.revision; }
  getMigrationOutcome(): MigrationOutcome { return "already_current"; }
  getLastOperationResult(): StateOperationResult { return { ...this.lastResult }; }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(); }
}

export const authenticatedProjectRepository = new AuthenticatedProjectRepository();
