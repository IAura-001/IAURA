import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IAuraProject } from "@/types/project";

const engineState = vi.hoisted(() => ({
  projects: new Map<string, IAuraProject>(),
  current: null as IAuraProject | null,
  listeners: new Set<() => void>(),
}));

const projectEngineMock = vi.hoisted(() => ({
  getProjects: vi.fn(() => Array.from(engineState.projects.values())),
  getCurrentProject: vi.fn(() => engineState.current),
  getProject: vi.fn((id: string) => engineState.projects.get(id)),
  setCurrentProject: vi.fn((project: IAuraProject) => {
    engineState.projects.set(project.id, project);
    engineState.current = project;
  }),
  subscribe: vi.fn((listener: () => void) => {
    engineState.listeners.add(listener);
    return () => engineState.listeners.delete(listener);
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
    engineState.listeners.clear();
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
      expect(onReady).toHaveBeenCalledTimes(1);
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

  it("stays stable with changing callback identities and updates only on repository notification", async () => {
    const projectA = project("project-a", "Project A");
    const projectB = project("project-b", "Project B");
    engineState.projects.set(projectA.id, projectA);
    engineState.current = projectA;

    const { rerender } = render(
      <ProjectList
        refreshKey={0}
        fallbackProject={projectA}
        onProjectSelected={vi.fn()}
        onReady={vi.fn()}
      />,
    );

    await screen.findByRole("button", { name: /Project A/i });
    const initialReadCount = projectEngineMock.getProjects.mock.calls.length;

    for (let index = 0; index < 5; index += 1) {
      rerender(
        <ProjectList
          refreshKey={0}
          fallbackProject={{ ...projectA }}
          onProjectSelected={vi.fn()}
          onReady={vi.fn()}
        />,
      );
    }

    expect(projectEngineMock.getProjects).toHaveBeenCalledTimes(initialReadCount);
    expect(projectEngineMock.setCurrentProject).toHaveBeenCalledTimes(1);

    engineState.projects.set(projectB.id, projectB);
    for (const listener of engineState.listeners) listener();

    expect(await screen.findByRole("button", { name: /Project B/i })).toBeInTheDocument();
    expect(projectEngineMock.getProjects).toHaveBeenCalledTimes(initialReadCount + 1);

    fireEvent.click(screen.getByRole("button", { name: /Project B/i }));
    expect(projectEngineMock.setCurrentProject).toHaveBeenLastCalledWith(projectB);
    expect(screen.getByRole("button", { name: /Project B/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("emits null when repository authority clears and does not leave stale rendered identity", async () => {
    const projectA = project("project-a", "Project A");
    const onProjectSelected = vi.fn();
    engineState.projects.set(projectA.id, projectA);
    engineState.current = projectA;
    render(<ProjectList refreshKey={0} onProjectSelected={onProjectSelected} />);
    await waitFor(() => expect(onProjectSelected).toHaveBeenCalledWith(projectA));

    engineState.current = null;
    act(() => { for (const listener of engineState.listeners) listener(); });

    expect(onProjectSelected).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: /Project A/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("emits one selection callback when repository notification is synchronous", async () => {
    const projectA = project("project-a", "Project A");
    const projectB = project("project-b", "Project B");
    const onProjectSelected = vi.fn();
    projectEngineMock.setCurrentProject.mockImplementation((selected) => {
      engineState.projects.set(selected.id, selected);
      engineState.current = selected;
      for (const listener of engineState.listeners) listener();
    });
    engineState.projects.set(projectA.id, projectA); engineState.projects.set(projectB.id, projectB); engineState.current = projectA;
    render(<ProjectList refreshKey={0} onProjectSelected={onProjectSelected} />);
    await waitFor(() => expect(onProjectSelected).toHaveBeenCalledWith(projectA));
    onProjectSelected.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /Project B/i }));
    expect(onProjectSelected).toHaveBeenCalledTimes(1);
    expect(onProjectSelected).toHaveBeenCalledWith(projectB);
  });
});
