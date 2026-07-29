export function generateRecommendation(userContext: string): string {
  if (userContext.includes("Goals:\n")) {
    const hasGoals = !userContext.includes("Goals:\n\n");

    if (!hasGoals) {
      return "Create your first goal to give IAURA a clear direction.";
    }
  }

  if (userContext.includes("Habits:\n")) {
    const hasHabits = !userContext.includes("Habits:\n\n");

    if (!hasHabits) {
      return "Add a daily habit to start building consistency.";
    }
  }

  return "Keep building momentum. Your profile is becoming stronger every day.";
}