import { projectStorage } from "./ProjectStorage";
import type {
  BrandingStudioMemory,
  IAuraProject,
  LaunchStudioMemory,
  ProjectKind,
  ProjectStatus,
  ProjectStudios,
} from "./types";
import type { CreativeStudioMemory } from "@/types/creative-studio";

export interface CreateProjectInput {
  name: string;
  description?: string;
  goal?: string;
  kind?: ProjectKind;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  goal?: string;
  status?: ProjectStatus;
  kind?: ProjectKind;
  studios?: Partial<ProjectStudios>;
  brandingStudio?: BrandingStudioMemory;
  launchStudio?: LaunchStudioMemory;
  creativeStudio?: CreativeStudioMemory;
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
  private lastPersistenceSucceeded = true;

  constructor() {
    const storedProjects = projectStorage.load();

    for (const project of storedProjects) {
      this.projects.set(project.id, project);
    }

    this.currentProjectId = storedProjects[0]?.id ?? null;
  }

  private persist(): void {
    this.lastPersistenceSucceeded = projectStorage.save(this.getProjects());
  }

  didLastPersistenceSucceed(): boolean {
    return this.lastPersistenceSucceeded;
  }

  createProject(input: CreateProjectInput): IAuraProject {
    const name = input.name.trim();

    if (!name) {
      throw new Error("Project name is required.");
    }

    const now = new Date().toISOString();

    const project: IAuraProject = {
      id: createProjectId(),
      name,
      description: input.description?.trim() ?? "",
      goal: input.goal?.trim() ?? "",
      createdAt: now,
      updatedAt: now,
      status: "planning",
      kind: input.kind ?? "general",
      studios: { ...DEFAULT_STUDIOS },
    };

    this.projects.set(project.id, project);
    this.currentProjectId = project.id;
    this.persist();

    return project;
  }

  getProjects(): IAuraProject[] {
    return Array.from(this.projects.values());
  }

  getProject(projectId: string): IAuraProject | null {
    return this.projects.get(projectId) ?? null;
  }

  setCurrentProject(project: IAuraProject): void {
    this.projects.set(project.id, project);
    this.currentProjectId = project.id;
    this.persist();
  }

  getCurrentProject(): IAuraProject | null {
    if (!this.currentProjectId) {
      return null;
    }

    return this.projects.get(this.currentProjectId) ?? null;
  }

  hasCurrentProject(): boolean {
    return this.getCurrentProject() !== null;
  }

  updateProject(
    projectId: string,
    updates: UpdateProjectInput,
  ): IAuraProject {
    const currentProject = this.projects.get(projectId);

    if (!currentProject) {
      throw new Error(`Project "${projectId}" was not found.`);
    }

    const updatedProject: IAuraProject = {
      ...currentProject,
      ...updates,
      name: updates.name?.trim() || currentProject.name,
      description:
        updates.description?.trim() ?? currentProject.description,
      goal: updates.goal?.trim() ?? currentProject.goal,
      studios: {
        ...currentProject.studios,
        ...updates.studios,
      },
      updatedAt: new Date().toISOString(),
    };

    this.projects.set(projectId, updatedProject);
    this.persist();

    return updatedProject;
  }

  updateBrandingStudio(
    projectId: string,
    brandingStudio: BrandingStudioMemory,
  ): IAuraProject {
    return this.updateProject(projectId, {
      brandingStudio,
      studios: {
        branding: true,
      },
    });
  }

  updateLaunchStudio(
    projectId: string,
    launchStudio: LaunchStudioMemory,
  ): IAuraProject {
    return this.updateProject(projectId, {
      launchStudio,
      studios: {
        marketing: true,
      },
    });
  }

  updateCreativeStudio(
    projectId: string,
    creativeStudio: CreativeStudioMemory,
  ): IAuraProject {
    const activatedStudios: Partial<ProjectStudios> = {
      branding: true,
    };

    if (creativeStudio.outputs["website-copy"]) {
      activatedStudios.website = true;
    }

    if (creativeStudio.outputs["social-kit"]) {
      activatedStudios.marketing = true;
    }

    return this.updateProject(projectId, {
      creativeStudio,
      studios: activatedStudios,
    });
  }

  deleteProject(projectId: string): boolean {
    const deleted = this.projects.delete(projectId);

    if (this.currentProjectId === projectId) {
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

export const projectEngine = new ProjectEngine();
