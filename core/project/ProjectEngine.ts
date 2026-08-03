import {
  LocalProjectRepository,
  projectRepository,
  type ProjectRepository,
  type ProjectRepositorySnapshot,
} from "./ProjectRepository";
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
  studios?: Partial<ProjectStudios>;
  createdAt?: string;
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

function studiosForKind(kind: ProjectKind): ProjectStudios {
  const business = kind === "business";
  const creative = kind === "creative";

  return {
    ...DEFAULT_STUDIOS,
    branding: business || creative,
    website: business,
    marketing: business,
    documents: business || kind === "learning",
  };
}

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
  private lastPersistenceSucceeded = true;

  constructor(
    private readonly repository: ProjectRepository =
      new LocalProjectRepository(),
  ) {}

  didLastPersistenceSucceed(): boolean {
    return this.lastPersistenceSucceeded;
  }

  getSnapshot(): ProjectRepositorySnapshot {
    return this.repository.getSnapshot();
  }

  restoreSnapshot(snapshot: ProjectRepositorySnapshot): boolean {
    this.lastPersistenceSucceeded =
      this.repository.replaceSnapshot(snapshot);
    return this.lastPersistenceSucceeded;
  }

  createProject(input: CreateProjectInput): IAuraProject {
    const name = input.name.trim();

    if (!name) {
      throw new Error("Project name is required.");
    }

    const equivalent = this.repository.findEquivalentProject(name);
    if (equivalent) {
      const active = this.repository.setActiveProject(equivalent);
      this.lastPersistenceSucceeded = active.persisted;
      return active.project;
    }

    const now = input.createdAt ?? new Date().toISOString();
    const kind = input.kind ?? "general";
    const project: IAuraProject = {
      id: createProjectId(),
      name,
      description: input.description?.trim() ?? "",
      goal: input.goal?.trim() ?? "",
      createdAt: now,
      updatedAt: now,
      status: "planning",
      kind,
      studios: {
        ...studiosForKind(kind),
        ...input.studios,
      },
    };

    const result = this.repository.createProject(project);
    this.lastPersistenceSucceeded = result.persisted;
    return result.project;
  }

  getProjects(): IAuraProject[] {
    return this.repository.getProjects();
  }

  getProject(projectId: string): IAuraProject | null {
    return this.repository.getProject(projectId);
  }

  findEquivalentProject(name: string): IAuraProject | null {
    return this.repository.findEquivalentProject(name);
  }

  setCurrentProject(project: IAuraProject): void {
    const result = this.repository.setActiveProject(project);
    this.lastPersistenceSucceeded = result.persisted;
  }

  getCurrentProject(): IAuraProject | null {
    return this.repository.getActiveProject();
  }

  hasCurrentProject(): boolean {
    return this.getCurrentProject() !== null;
  }

  updateProject(
    projectId: string,
    updates: UpdateProjectInput,
  ): IAuraProject {
    const currentProject = this.repository.getProject(projectId);

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

    const result = this.repository.updateProject(updatedProject);
    this.lastPersistenceSucceeded = result.persisted;
    return result.project;
  }

  updateBrandingStudio(
    projectId: string,
    brandingStudio: BrandingStudioMemory,
  ): IAuraProject {
    return this.updateProject(projectId, {
      brandingStudio,
      studios: { branding: true },
    });
  }

  updateLaunchStudio(
    projectId: string,
    launchStudio: LaunchStudioMemory,
  ): IAuraProject {
    return this.updateProject(projectId, {
      launchStudio,
      studios: { marketing: true },
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
    const exists = this.repository.getProject(projectId) !== null;
    this.lastPersistenceSucceeded =
      exists && this.repository.deleteProject(projectId);
    return exists;
  }

  clearCurrentProject(): void {
    this.lastPersistenceSucceeded =
      this.repository.clearActiveProject();
  }
}

export const projectEngine = new ProjectEngine(projectRepository);
