"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { rewardXP } from "@/utils/xp";
import { completeMission } from "@/utils/mission";
import { DEFAULT_MEMORY } from "@/constants/memory";
import type { Memory } from "@/types/memory";


const STORAGE_KEY = "iaura-memory";

function loadStoredMemory(): Memory {
  try {
    const savedMemory =
      localStorage.getItem(STORAGE_KEY);

    if (!savedMemory) {
      return DEFAULT_MEMORY;
    }

    const parsedMemory = JSON.parse(
      savedMemory
    ) as Partial<Memory>;

    return {
      ...DEFAULT_MEMORY,
      ...parsedMemory,
      goals: Array.isArray(parsedMemory.goals)
        ? parsedMemory.goals
        : [],
      habits: Array.isArray(
        parsedMemory.habits
      )
        ? parsedMemory.habits
        : [],
      projects: Array.isArray(
        parsedMemory.projects
      )
        ? parsedMemory.projects
        : [],
      activeProject:
        parsedMemory.activeProject ?? null,
      completedMissionIds: Array.isArray(
        parsedMemory.completedMissionIds
      )
        ? parsedMemory.completedMissionIds
        : [],
    };
  } catch (error) {
    console.error(
      "Unable to load IAURA memory:",
      error
    );

    return DEFAULT_MEMORY;
  }
}

export function useMemory() {
  const [memory, setMemory] =
    useState<Memory>(DEFAULT_MEMORY);
  const [isLoaded, setIsLoaded] =
    useState(false);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(
      () => {
        setMemory(loadStoredMemory());
        setIsLoaded(true);
      },
      0
    );

    return () => {
      window.clearTimeout(hydrationTimer);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch (error) {
      console.error("Unable to save IAURA memory:", error);
    }
  }, [memory, isLoaded]);

  const updateMemory = useCallback(
    (updates: Partial<Memory>) => {
      setMemory((currentMemory) => ({
        ...currentMemory,
        ...updates,
      }));
    },
    []
  );

  const replaceMemory = useCallback(
    (nextMemory: Memory) => {
      setMemory(nextMemory);
    },
    []
  );

  function addExperience(amount: number) {
    setMemory((currentMemory) => ({
      ...rewardXP(currentMemory, amount),
    }));
  }

  function markMissionComplete(
    missionId: string,
    xpReward = 25
  ) {
    setMemory((currentMemory) =>
      completeMission(
        currentMemory,
        missionId,
        xpReward
      )
    );
  }

  function resetMemory() {
    setMemory(DEFAULT_MEMORY);
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    memory,
    isLoaded,
    updateMemory,
    replaceMemory,
    addExperience,
    markMissionComplete,
    resetMemory,
  };
}
