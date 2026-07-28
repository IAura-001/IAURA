"use client";

import { useEffect, useState } from "react";
import { rewardXP } from "@/utils/xp";
import { completeMission } from "@/utils/mission";
import { DEFAULT_MEMORY } from "@/constants/memory";
import type { Memory } from "@/types/memory";

const STORAGE_KEY = "iaura-memory";

export function useMemory() {
  const [memory, setMemory] = useState<Memory>(DEFAULT_MEMORY);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedMemory = localStorage.getItem(STORAGE_KEY);

      if (savedMemory) {
  const parsedMemory = JSON.parse(savedMemory) as Partial<Memory>;

  setMemory({
    ...DEFAULT_MEMORY,
    ...parsedMemory,
    completedMissionIds: parsedMemory.completedMissionIds ?? [],
  });
}
    } catch (error) {
      console.error("Unable to load IAURA memory:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch (error) {
      console.error("Unable to save IAURA memory:", error);
    }
  }, [memory, isLoaded]);

  function updateMemory(updates: Partial<Memory>) {
    setMemory((currentMemory) => ({
      ...currentMemory,
      ...updates,
    }));
  }
function addExperience(amount: number) {
  setMemory((currentMemory) =>
    rewardXP(currentMemory, amount)
  );
}
function markMissionComplete(
  missionId: string,
  xpReward = 25
) {
  setMemory((currentMemory) =>
    completeMission(currentMemory, missionId, xpReward)
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
    addExperience,
    markMissionComplete,
    resetMemory,

  };
}