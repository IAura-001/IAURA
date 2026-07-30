import type { IAuraProject } from "@/types/project";

export class ProjectEngine {
  private currentProject: IAuraProject | null = null;

  setCurrentProject(project: IAuraProject): void {
    this.currentProject = project;
  }

  getCurrentProject(): IAuraProject | null {
    return this.currentProject;
  }

  hasCurrentProject(): boolean {
    return this.currentProject !== null;
  }

  clearCurrentProject(): void {
    this.currentProject = null;
  }
}