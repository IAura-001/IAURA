import { MISSIONS } from "@/constants/missions";
import type { Memory } from "@/types/memory";

export function buildUserContext(memory: Memory): string {
  return `
USER PROFILE

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
