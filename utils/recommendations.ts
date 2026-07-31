import type { SupportedLocale } from "@/core/i18n/languages";
import { translate } from "@/core/i18n/messages";

export function generateRecommendation(
  userContext: string,
  locale: SupportedLocale
): string {
  if (userContext.includes("Goals:\n")) {
    const hasGoals = !userContext.includes("Goals:\n\n");

    if (!hasGoals) {
      return translate(
        locale,
        "recommendation.goal"
      );
    }
  }

  if (userContext.includes("Habits:\n")) {
    const hasHabits = !userContext.includes("Habits:\n\n");

    if (!hasHabits) {
      return translate(
        locale,
        "recommendation.habit"
      );
    }
  }

  return translate(
    locale,
    "recommendation.momentum"
  );
}
