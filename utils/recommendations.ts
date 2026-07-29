export function generateRecommendation(
  goals: string[],
  habits: string[]
): string {
  if (goals.length === 0) {
    return "Create your first goal to give IAURA a clear direction.";
  }

  if (habits.length === 0) {
    return "Add a daily habit to start building consistency.";
  }

  if (goals.length > habits.length) {
    return "Focus on turning your goals into repeatable daily habits.";
  }

  if (habits.length > goals.length) {
    return "You have solid habits. Define more ambitious goals.";
  }

  return "Keep balancing your goals and habits. You're building momentum.";
}