import { MISSIONS } from "@/constants/missions";
import type { Memory } from "@/types/memory";
import {
  projectEngine,
  type ProjectEngine,
} from "@/core/project/ProjectEngine";
import { completeMission } from "@/utils/mission";

import type {
  ActionExecutionItem,
  ActionExecutionResult,
  PlannedAuraAction,
} from "./types";

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function includesValue(
  values: string[],
  value: string
): boolean {
  const normalizedValue = normalize(value);

  return values.some(
    (currentValue) =>
      normalize(currentValue) === normalizedValue
  );
}

function removeValue(
  values: string[],
  value: string
): string[] | null {
  const normalizedValue = normalize(value);
  const index = values.findIndex(
    (currentValue) =>
      normalize(currentValue) === normalizedValue
  );

  if (index < 0) {
    return null;
  }

  return values.filter(
    (_, currentIndex) => currentIndex !== index
  );
}

function skipped(
  action: PlannedAuraAction,
  summary: string,
  reason: string
): ActionExecutionItem {
  return {
    type: action.type,
    status: "skipped",
    summary,
    reason,
  };
}

function executed(
  action: PlannedAuraAction,
  summary: string
): ActionExecutionItem {
  return {
    type: action.type,
    status: "executed",
    summary,
    reason: action.reason,
  };
}

export interface ActionExecutorDependencies {
  projectEngine: Pick<
    ProjectEngine,
    | "createProject"
    | "didLastPersistenceSucceed"
    | "findEquivalentProject"
    | "getProjects"
    | "getSnapshot"
    | "restoreSnapshot"
  >;
}

const DEFAULT_DEPENDENCIES: ActionExecutorDependencies = {
  projectEngine,
};

export function executeAuraActions(
  memory: Memory,
  actions: PlannedAuraAction[],
  now = new Date(),
  dependencies: ActionExecutorDependencies = DEFAULT_DEPENDENCIES,
): ActionExecutionResult {
  let nextMemory: Memory = {
    ...memory,
    goals: [...memory.goals],
    habits: [...memory.habits],
    projects: [...memory.projects],
    completedMissionIds: [
      ...memory.completedMissionIds,
    ],
  };

  const items: ActionExecutionItem[] = [];
  const createdAt = now.toISOString();

  for (const action of actions.slice(0, 8)) {
    if (
      action.type === "add_goal"
    ) {
      if (!action.value) {
        items.push(
          skipped(
            action,
            "Meta sin contenido",
            "La meta estaba vacía."
          )
        );
        continue;
      }

      if (
        includesValue(
          nextMemory.goals,
          action.value
        )
      ) {
        items.push(
          skipped(
            action,
            `Meta ya existente: ${action.value}`,
            "IAURA evita metas duplicadas."
          )
        );
        continue;
      }

      nextMemory = {
        ...nextMemory,
        goals: [
          ...nextMemory.goals,
          action.value,
        ],
      };
      items.push(
        executed(
          action,
          `Meta creada: ${action.value}`
        )
      );
      continue;
    }

    if (
      action.type === "remove_goal"
    ) {
      const goals = removeValue(
        nextMemory.goals,
        action.value
      );

      if (!goals) {
        items.push(
          skipped(
            action,
            `Meta no encontrada: ${action.value}`,
            "No se eliminó ninguna meta."
          )
        );
        continue;
      }

      nextMemory = {
        ...nextMemory,
        goals,
      };
      items.push(
        executed(
          action,
          `Meta eliminada: ${action.value}`
        )
      );
      continue;
    }

    if (
      action.type === "add_habit"
    ) {
      if (!action.value) {
        items.push(
          skipped(
            action,
            "Hábito sin contenido",
            "El hábito estaba vacío."
          )
        );
        continue;
      }

      if (
        includesValue(
          nextMemory.habits,
          action.value
        )
      ) {
        items.push(
          skipped(
            action,
            `Hábito ya existente: ${action.value}`,
            "IAURA evita hábitos duplicados."
          )
        );
        continue;
      }

      nextMemory = {
        ...nextMemory,
        habits: [
          ...nextMemory.habits,
          action.value,
        ],
      };
      items.push(
        executed(
          action,
          `Hábito creado: ${action.value}`
        )
      );
      continue;
    }

    if (
      action.type === "remove_habit"
    ) {
      const habits = removeValue(
        nextMemory.habits,
        action.value
      );

      if (!habits) {
        items.push(
          skipped(
            action,
            `Hábito no encontrado: ${action.value}`,
            "No se eliminó ningún hábito."
          )
        );
        continue;
      }

      nextMemory = {
        ...nextMemory,
        habits,
      };
      items.push(
        executed(
          action,
          `Hábito eliminado: ${action.value}`
        )
      );
      continue;
    }

    if (
      action.type === "set_user_name"
    ) {
      if (!action.value) {
        items.push(
          skipped(
            action,
            "Nombre sin contenido",
            "El nombre estaba vacío."
          )
        );
        continue;
      }

      if (
        normalize(nextMemory.userName) ===
        normalize(action.value)
      ) {
        items.push(
          skipped(
            action,
            `Nombre ya configurado: ${action.value}`,
            "No era necesario cambiarlo."
          )
        );
        continue;
      }

      nextMemory = {
        ...nextMemory,
        userName: action.value,
      };
      items.push(
        executed(
          action,
          `Nombre actualizado: ${action.value}`
        )
      );
      continue;
    }

    if (
      action.type === "create_project"
    ) {
      if (!action.value) {
        items.push(
          skipped(
            action,
            "Proyecto sin nombre",
            "El proyecto necesita un nombre."
          )
        );
        continue;
      }

      if (dependencies.projectEngine.findEquivalentProject(action.value)) {
        items.push(
          skipped(
            action,
            `Proyecto ya existente: ${action.value}`,
            "IAURA evita proyectos duplicados."
          )
        );
        continue;
      }

      const projectStateBefore =
        dependencies.projectEngine.getSnapshot();
      const activeProject = dependencies.projectEngine.createProject({
        name: action.value,
        description:
          action.description || "Proyecto creado con IAURA.",
        goal:
          action.goal || "Convertir esta idea en un proyecto real.",
        kind: action.projectKind ?? "general",
        createdAt,
      });

      if (!dependencies.projectEngine.didLastPersistenceSucceed()) {
        dependencies.projectEngine.restoreSnapshot(projectStateBefore);
        items.push(
          skipped(
            action,
            `Proyecto no guardado: ${activeProject.name}`,
            "La persistencia local falló; IAURA no confirmó la creación.",
          ),
        );
        continue;
      }

      const persistedProjectNames = dependencies.projectEngine
        .getProjects()
        .map((project) => project.name);

      nextMemory = {
        ...nextMemory,
        projects: Array.from(
          new Set([...nextMemory.projects, ...persistedProjectNames]),
        ),
        activeProject,
      };
      items.push(
        executed(
          action,
          `Proyecto creado: ${activeProject.name}`
        )
      );
      continue;
    }

    if (
      action.type === "complete_mission"
    ) {
      const mission = MISSIONS.find(
        (candidate) =>
          candidate.id === action.missionId
      );

      if (!mission) {
        items.push(
          skipped(
            action,
            `Misión no encontrada: ${action.missionId}`,
            "El identificador de misión no existe."
          )
        );
        continue;
      }

      if (
        nextMemory.completedMissionIds.includes(
          mission.id
        )
      ) {
        items.push(
          skipped(
            action,
            `Misión ya completada: ${mission.title}`,
            "IAURA evita recompensas duplicadas."
          )
        );
        continue;
      }

      nextMemory = completeMission(
        nextMemory,
        mission.id,
        25
      );
      items.push(
        executed(
          action,
          `Misión completada: ${mission.title}`
        )
      );
    }
  }

  return {
    memory: nextMemory,
    items,
  };
}
