import { Memory } from "@/types/memory";
import { getLevelFromExperience } from "./level";

export function rewardXP(
  memory: Memory,
  amount: number
): Memory {
  const experience = memory.experience + amount;

  return {
    ...memory,
    experience,
    level: getLevelFromExperience(experience),
  };
}