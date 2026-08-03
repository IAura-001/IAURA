import { MISSIONS } from "@/constants/missions";
import type { Memory } from "@/types/memory";
import { getLanguageDefinition } from "@/core/i18n/languages";

export function buildUserContext(memory: Memory): string {
  const preferredLanguage =
    getLanguageDefinition(
      memory.preferredLocale
    );

  return `
USER PROFILE

Preferred Language: ${preferredLanguage.englishName} (${preferredLanguage.locale})

Level: ${memory.level}
XP: ${memory.experience}
Streak: ${memory.streak}

Goals:
${memory.goals.map((goal) => `- ${goal}`).join("\n")}

Habits:
${memory.habits.map((habit) => `- ${habit}`).join("\n")}

Available Missions:
${MISSIONS.map(
  (mission) =>
    `- ${mission.id}: ${mission.title}`
).join("\n")}

Completed Mission IDs:
${
  memory.completedMissionIds.length > 0
    ? memory.completedMissionIds.join(", ")
    : "None"
}
`.trim();
}
