import {
  projectRepository,
  type ProjectRepository,
} from "./ProjectRepository";
import type { IAuraProject } from "./types";

/** Compatibility adapter for legacy ProjectStorage callers. */
export class ProjectStorage {
  constructor(
    private readonly repository: ProjectRepository = projectRepository,
  ) {}

  save(projects: IAuraProject[]): boolean {
    const currentActiveId =
      this.repository.getActiveProject()?.id ?? null;
    const activeProjectId = projects.some(
      (project) => project.id === currentActiveId,
    )
      ? currentActiveId
      : projects[0]?.id ?? null;

    return this.repository.replaceSnapshot({
      schemaVersion: 1,
      activeProjectId,
      projects,
    });
  }

  load(): IAuraProject[] {
    return this.repository.getProjects();
  }

  clear(): void {
    this.repository.replaceSnapshot({
      schemaVersion: 1,
      activeProjectId: null,
      projects: [],
    });
  }
}

export const projectStorage = new ProjectStorage();
