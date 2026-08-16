import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IAuraProject } from "@/types/project";

const engineState = vi.hoisted(() => ({
  projects: new Map<string, IAuraProject>(),
  current: null as IAuraProject | null,
}));

const projectEngineMock = vi.hoisted(() => ({
  getProjects: vi.fn(() => Array.from(engineState.projects.values())),
  getCurrentProject: vi.fn(() => engineState.current),
  getProject: vi.fn((id: string) => engineState.projects.get(id)),
  setCurrentProject: vi.fn((project: IAuraProject) => {
    engineState.projects.set(project.id, project);
    engineState.current = project;
  }),
}));

vi.mock("@/core/project/ProjectEngine", () => ({
  projectEngine: projectEngineMock,
}));

import ProjectList from "@/components/projects/ProjectList";

function project(id: string, name: string): IAuraProject {
  return {
    id,
    name,
    description: `${name} description`,
    goal: `${name} goal`,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    status: "building",
    studios: {
      branding: false,
      website: false,
      app: false,
      marketing: false,
      documents: false,
    },
  };
}

describe("ProjectList fallback synchronization", () => {
  beforeEach(() => {
    engineState.projects.clear();
    engineState.current = null;
    vi.clearAllMocks();
  });

  it("selects only remote projects and never imports a missing memory fallback", async () => {
    const projectA = project("project-a", "Project A");
    const projectB = project("project-b", "Project B");
    const onProjectSelected = vi.fn();
    const onReady = vi.fn();
    engineState.projects.set(projectA.id, projectA);
    const { rerender } = render(
      <ProjectList
        refreshKey={0}
        fallbackProject={projectA}
        onProjectSelected={onProjectSelected}
        onReady={onReady}
      />,
    );

    await waitFor(() => {
      expect(onProjectSelected).toHaveBeenLastCalledWith(projectA);
      expect(engineState.current?.id).toBe("project-a");
      expect(
        screen.getByRole("button", { name: /Project A/i }),
      ).toHaveAttribute("aria-pressed", "true");
    });

    rerender(
      <ProjectList
        refreshKey={0}
        fallbackProject={projectB}
        onProjectSelected={onProjectSelected}
        onReady={onReady}
      />,
    );

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(2);
      expect(engineState.current?.id).toBe("project-a");
      expect(
        screen.getByRole("button", { name: /Project A/i }),
      ).toHaveAttribute("aria-pressed", "true");
    });

    expect(projectEngineMock.setCurrentProject).toHaveBeenCalledWith(projectA);
    expect(projectEngineMock.setCurrentProject).not.toHaveBeenCalledWith(projectB);
    expect(onProjectSelected).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Project B/i })).not.toBeInTheDocument();
  });
});
