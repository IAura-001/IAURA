import { describe, expect, it } from "vitest";

import { DEFAULT_MEMORY } from "@/constants/memory";

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
