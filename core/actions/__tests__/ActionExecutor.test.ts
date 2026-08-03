import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MEMORY } from "@/constants/memory";
import { ProjectEngine, projectEngine } from "@/core/project/ProjectEngine";

import { executeAuraActions } from "../ActionExecutor";
import type { PlannedAuraAction } from "../types";

function action(
  type: PlannedAuraAction["type"],
  value = "",
  overrides: Partial<PlannedAuraAction> = {}
): PlannedAuraAction {
  return {
    type,
    value,
    description: "",
    goal: "",
    missionId: "",
    reason: "Requested by the user.",
    ...overrides,
  };
}

describe("ActionExecutor", () => {
  beforeEach(() => {
    window.localStorage.clear();
    projectEngine.restoreSnapshot({
      schemaVersion: 1,
      activeProjectId: null,
      projects: [],
    });
  });

  it("executes safe life actions in one batch", () => {
    const result = executeAuraActions(
      {
        ...DEFAULT_MEMORY,
        goals: [],
        habits: [],
      },
      [
        action("add_goal", "Dormir mejor"),
        action("add_habit", "Caminar 20 minutos"),
      ]
    );

    expect(result.memory.goals).toContain(
      "Dormir mejor"
    );
    expect(result.memory.habits).toContain(
      "Caminar 20 minutos"
    );
    expect(
      result.items.every(
        (item) => item.status === "executed"
      )
    ).toBe(true);
  });

  it("does not create duplicate goals", () => {
    const result = executeAuraActions(
      {
        ...DEFAULT_MEMORY,
        goals: ["Aprender inglés"],
      },
      [
        action(
          "add_goal",
          "aprender inglés"
        ),
      ]
    );

    expect(result.memory.goals).toHaveLength(1);
    expect(result.items[0].status).toBe(
      "skipped"
    );
  });

  it("creates and activates a project", () => {
    const result = executeAuraActions(
      {
        ...DEFAULT_MEMORY,
        projects: [],
      },
      [
        action("create_project", "Aura Health", {
          description:
            "Una experiencia de bienestar.",
          goal:
            "Ayudar a crear rutinas saludables.",
        }),
      ],
      new Date("2026-07-30T12:00:00.000Z")
    );

    expect(result.memory.projects).toContain(
      "Aura Health"
    );
    expect(
      result.memory.activeProject?.name
    ).toBe("Aura Health");
    expect(
      result.memory.activeProject?.createdAt
    ).toBe("2026-07-30T12:00:00.000Z");
  });

  it("does not force personal and wellbeing work into branding", () => {
    const result = executeAuraActions(
      {
        ...DEFAULT_MEMORY,
        projects: [],
      },
      [
        action("create_project", "Dormir mejor", {
          projectKind: "wellbeing",
          goal: "Construir una rutina de sueño sostenible.",
        }),
      ],
    );

    expect(result.memory.activeProject?.kind).toBe("wellbeing");
    expect(result.memory.activeProject?.studios.branding).toBe(false);
    expect(result.memory.activeProject?.studios.marketing).toBe(false);
  });

  it("keeps the complete creative system available for business projects", () => {
    const result = executeAuraActions(
      {
        ...DEFAULT_MEMORY,
        projects: [],
      },
      [
        action("create_project", "Mita", {
          projectKind: "business",
        }),
      ],
    );

    expect(result.memory.activeProject?.kind).toBe("business");
    expect(result.memory.activeProject?.studios.branding).toBe(true);
    expect(result.memory.activeProject?.studios.website).toBe(true);
  });

  it("does not create an equivalent project twice across action calls", () => {
    const first = executeAuraActions(
      { ...DEFAULT_MEMORY, projects: [] },
      [action("create_project", "VAEORA")],
    );
    const second = executeAuraActions(
      { ...DEFAULT_MEMORY, projects: [] },
      [action("create_project", " vaeora ")],
    );

    expect(first.items[0].status).toBe("executed");
    expect(second.items[0].status).toBe("skipped");
    expect(projectEngine.getProjects()).toHaveLength(1);
  });

  it("does not return a false success when project persistence fails", () => {
    const isolatedEngine = new ProjectEngine();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });

    const result = executeAuraActions(
      { ...DEFAULT_MEMORY, projects: [], activeProject: null },
      [action("create_project", "Unpersisted")],
      new Date("2026-08-02T00:00:00.000Z"),
      { projectEngine: isolatedEngine },
    );

    expect(result.items[0]).toMatchObject({
      status: "skipped",
      summary: "Proyecto no guardado: Unpersisted",
    });
    expect(result.memory.activeProject).toBeNull();
    expect(isolatedEngine.getProjects()).toEqual([]);
    setItem.mockRestore();
  });

  it("creates a real project when only a stale legacy name exists", () => {
    const result = executeAuraActions(
      {
        ...DEFAULT_MEMORY,
        projects: ["Name-only legacy project"],
        activeProject: null,
      },
      [action("create_project", "Name-only legacy project")],
    );

    expect(result.items[0].status).toBe("executed");
    expect(projectEngine.getProjects()).toHaveLength(1);
    expect(result.memory.activeProject?.name).toBe(
      "Name-only legacy project",
    );
  });

  it("awards mission XP only once", () => {
    const first = executeAuraActions(
      {
        ...DEFAULT_MEMORY,
        completedMissionIds: [],
        experience: 0,
      },
      [
        action("complete_mission", "", {
          missionId: "001",
        }),
      ]
    );

    const second = executeAuraActions(
      first.memory,
      [
        action("complete_mission", "", {
          missionId: "001",
        }),
      ]
    );

    expect(first.memory.experience).toBe(25);
    expect(second.memory.experience).toBe(25);
    expect(second.items[0].status).toBe(
      "skipped"
    );
  });
});
