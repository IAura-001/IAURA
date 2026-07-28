import type { Memory } from "@/types/memory";
import { rewardXP } from "@/utils/xp";

export function completeMission(
  memory: Memory,
  missionId: string,
  xpReward = 25
): Memory {
  const completedMissionIds = memory.completedMissionIds ?? [];

  if (completedMissionIds.includes(missionId)) {
    return memory;
  }

  const updatedMemory: Memory = {
    ...memory,
    completedMissions: memory.completedMissions + 1,
    completedMissionIds: [...completedMissionIds, missionId],
  };

  return rewardXP(updatedMemory, xpReward);
}