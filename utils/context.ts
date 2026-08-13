import type { Memory } from "@/types/memory";
import { getLanguageDefinition } from "@/core/i18n/languages";

export function buildUserContext(memory: Memory): string {
  const preferredLanguage =
    getLanguageDefinition(
      memory.preferredLocale
    );

  return `
PERSONAL INTELLIGENCE — GLOBAL USER CONTEXT

Scope: This information belongs to the user globally, not to any active project.
Free-text goals, habits, project lists, missions, and mission progress are excluded because they do not carry a trusted project scope.

Preferred Language: ${preferredLanguage.englishName} (${preferredLanguage.locale})

Level: ${memory.level}
XP: ${memory.experience}
Streak: ${memory.streak}
`.trim();
}
