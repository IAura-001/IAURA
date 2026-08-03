"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  executeAuraActions,
  type ActionExecutionItem,
  type AuraActionHistoryEntry,
  type PlannedAuraAction,
} from "@/core/actions";
import type { Memory } from "@/types/memory";
import { memoryRepository } from "@/core/memory/MemoryRepository";
import { projectEngine } from "@/core/project/ProjectEngine";

const ACTION_HISTORY_KEY =
  "iaura-action-history";
const MAX_HISTORY_ENTRIES = 20;

interface UseAuraActionsInput {
  memory: Memory;
  replaceMemory: (memory: Memory) => void;
}

function cloneMemory(memory: Memory): Memory {
  return JSON.parse(
    JSON.stringify(memory)
  ) as Memory;
}

function sameMemory(
  first: Memory,
  second: Memory
): boolean {
  return (
    JSON.stringify(first) ===
    JSON.stringify(second)
  );
}

function createHistoryId(): string {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function loadHistory(): AuraActionHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const savedHistory = localStorage.getItem(
      ACTION_HISTORY_KEY
    );

    if (!savedHistory) {
      return [];
    }

    const parsedHistory = JSON.parse(
      savedHistory
    ) as unknown;

    return Array.isArray(parsedHistory)
      ? (
          parsedHistory as AuraActionHistoryEntry[]
        ).slice(0, MAX_HISTORY_ENTRIES)
      : [];
  } catch (error) {
    console.error(
      "Unable to load IAURA action history:",
      error
    );
    return [];
  }
}

export function useAuraActions({
  memory,
  replaceMemory,
}: UseAuraActionsInput) {
  const memoryRef = useRef(memory);

  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  const [history, setHistory] = useState<
    AuraActionHistoryEntry[]
  >(loadHistory);

  useEffect(() => {
    try {
      localStorage.setItem(
        ACTION_HISTORY_KEY,
        JSON.stringify(history)
      );
    } catch (error) {
      console.error(
        "Unable to save IAURA action history:",
        error
      );
    }
  }, [history]);

  const executeActions = useCallback(
    (
      actions: PlannedAuraAction[]
    ): ActionExecutionItem[] => {
      if (actions.length === 0) {
        return [];
      }

      const before = cloneMemory(
        memoryRef.current
      );
      const projectStateBefore = projectEngine.getSnapshot();
      const result = executeAuraActions(
        before,
        actions
      );
      const executedItems = result.items.filter(
        (item) => item.status === "executed"
      );

      if (executedItems.length === 0) {
        return result.items;
      }

      const after = cloneMemory(result.memory);
      if (!memoryRepository.saveMemory(after)) {
        projectEngine.restoreSnapshot(projectStateBefore);
        return result.items.map((item) =>
          item.status === "executed"
            ? {
                ...item,
                status: "skipped" as const,
                reason:
                  "La persistencia local falló; IAURA no confirmó el cambio.",
              }
            : item,
        );
      }

      const historyEntry: AuraActionHistoryEntry = {
        id: createHistoryId(),
        createdAt: new Date().toISOString(),
        status: "completed",
        summaries: executedItems.map(
          (item) => item.summary
        ),
        before,
        after,
        projectStateBefore,
        projectStateAfter: projectEngine.getSnapshot(),
      };

      replaceMemory(after);
      setHistory((currentHistory) =>
        [
          historyEntry,
          ...currentHistory,
        ].slice(0, MAX_HISTORY_ENTRIES)
      );

      return result.items;
    },
    [replaceMemory]
  );

  const latestCompletedEntry = useMemo(
    () =>
      history.find(
        (entry) =>
          entry.status === "completed"
      ) ?? null,
    [history]
  );

  const canUndoLast =
    latestCompletedEntry !== null &&
    sameMemory(
      memory,
      latestCompletedEntry.after
    );

  const undoLast = useCallback((): boolean => {
    if (
      !latestCompletedEntry ||
      !sameMemory(
        memory,
        latestCompletedEntry.after
      )
    ) {
      return false;
    }

    const restoredMemory = cloneMemory(
      latestCompletedEntry.before,
    );
    if (latestCompletedEntry.projectStateBefore) {
      if (
        !projectEngine.restoreSnapshot(
          latestCompletedEntry.projectStateBefore,
        )
      ) {
        return false;
      }
    } else if (
      latestCompletedEntry.after.activeProject &&
      !latestCompletedEntry.before.projects.some(
        (name) =>
          name.trim().toLocaleLowerCase() ===
          latestCompletedEntry.after.activeProject?.name
            .trim()
            .toLocaleLowerCase(),
      )
    ) {
      const createdProjectId =
        latestCompletedEntry.after.activeProject.id;
      const currentSnapshot = projectEngine.getSnapshot();
      if (
        !projectEngine.restoreSnapshot({
          ...currentSnapshot,
          activeProjectId:
            restoredMemory.activeProject?.id ?? null,
          projects: currentSnapshot.projects.filter(
            (project) => project.id !== createdProjectId,
          ),
        })
      ) {
        return false;
      }
    } else if (restoredMemory.activeProject) {
      projectEngine.setCurrentProject(restoredMemory.activeProject);
      if (!projectEngine.didLastPersistenceSucceed()) return false;
    } else {
      projectEngine.clearCurrentProject();
      if (!projectEngine.didLastPersistenceSucceed()) return false;
    }

    if (!memoryRepository.saveMemory(restoredMemory)) {
      if (latestCompletedEntry.projectStateAfter) {
        projectEngine.restoreSnapshot(
          latestCompletedEntry.projectStateAfter,
        );
      }
      return false;
    }

    replaceMemory(restoredMemory);

    setHistory((currentHistory) =>
      currentHistory.map((entry) =>
        entry.id === latestCompletedEntry.id
          ? {
              ...entry,
              status: "undone",
            }
          : entry
      )
    );

    return true;
  }, [
    latestCompletedEntry,
    memory,
    replaceMemory,
  ]);

  return {
    history,
    executeActions,
    canUndoLast,
    undoLast,
  };
}
