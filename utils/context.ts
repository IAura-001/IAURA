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

Projects:
${memory.projects.map((project) => `- ${project}`).join("\n")}

Active Project:
${
  memory.activeProject
    ? [
        `Name: ${memory.activeProject.name}`,
        `Kind: ${memory.activeProject.kind ?? "general"}`,
        `Goal: ${memory.activeProject.goal}`,
        `Status: ${memory.activeProject.status}`,
      ].join("\n")
    : "No active project."
}

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
