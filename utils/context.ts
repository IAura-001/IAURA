import { Memory } from "@/types/memory";

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
`.trim();
}