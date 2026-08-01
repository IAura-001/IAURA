import { projectStorage } from "./ProjectStorage";

import type {
  IAuraProject,
  ProjectStatus,
  ProjectStudios,
} from "./types";

export interface CreateProjectInput {
  name: string;
  description?: string;
  goal?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  goal?: string;
  status?: ProjectStatus;
  studios?: Partial<ProjectStudios>;
}

const DEFAULT_STUDIOS: ProjectStudios = {
  branding: false,
  website: false,
  app: false,
  marketing: false,
  documents: false,
};

function createProjectId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    "randomUUID" in globalThis.crypto
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export class ProjectEngine {
  private projects = new Map<string, IAuraProject>();
  private currentProjectId: string | null = null;

  constructor() {
    const storedProjects = projectStorage.load();

    for (const project of storedProjects) {
      this.projects.set(project.id, project);
    }

    this.currentProjectId =
      storedProjects[0]?.id ?? null;
  }

  private persist(): void {
    projectStorage.save(this.getProjects());
  }

  createProject(
    input: CreateProjectInput,
  ): IAuraProject {
    const name = input.name.trim();

    if (!name) {
      throw new Error("Project name is required.");
    }

    const now = new Date().toISOString();

    const project: IAuraProject = {
      id: createProjectId(),
      name,
      description:
        input.description?.trim() ?? "",
      goal: input.goal?.trim() ?? "",
      createdAt: now,
      updatedAt: now,
      status: "planning",
      studios: {
        ...DEFAULT_STUDIOS,
      },
    };

    this.projects.set(project.id, project);
    this.currentProjectId = project.id;
    this.persist();

    return project;
  }

  getProjects(): IAuraProject[] {
    return Array.from(this.projects.values());
  }

  getProject(
    projectId: string,
  ): IAuraProject | null {
    return this.projects.get(projectId) ?? null;
  }

  setCurrentProject(
    project: IAuraProject,
  ): void {
    this.projects.set(project.id, project);
    this.currentProjectId = project.id;
    this.persist();
  }

  getCurrentProject(): IAuraProject | null {
    if (!this.currentProjectId) {
      return null;
    }

    return (
      this.projects.get(this.currentProjectId) ??
      null
    );
  }

  hasCurrentProject(): boolean {
    return this.getCurrentProject() !== null;
  }

  updateProject(
    projectId: string,
    updates: UpdateProjectInput,
  ): IAuraProject {
    const currentProject =
      this.projects.get(projectId);

    if (!currentProject) {
      throw new Error(
        `Project "${projectId}" was not found.`,
      );
    }

    const updatedProject: IAuraProject = {
      ...currentProject,
      ...updates,
      name:
        updates.name?.trim() ||
        currentProject.name,
      description:
        updates.description?.trim() ??
        currentProject.description,
      goal:
        updates.goal?.trim() ??
        currentProject.goal,
      studios: {
        ...currentProject.studios,
        ...updates.studios,
      },
      updatedAt: new Date().toISOString(),
    };

    this.projects.set(
      projectId,
      updatedProject,
    );

    this.persist();

    return updatedProject;
  }

  deleteProject(projectId: string): boolean {
    const deleted =
      this.projects.delete(projectId);

    if (
      this.currentProjectId === projectId
    ) {
      this.currentProjectId = null;
    }

    if (deleted) {
      this.persist();
    }

    return deleted;
  }

  clearCurrentProject(): void {
    this.currentProjectId = null;
  }
}

export const projectEngine =
  new ProjectEngine();