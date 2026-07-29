export type PriorityItem = {
  title: string;
  score: number;
};

export function generatePriorities(
  goals: string[],
  habits: string[]
): PriorityItem[] {
  const items: PriorityItem[] = [];

  goals.forEach((goal) => {
    items.push({
      title: goal,
      score: 100,
    });
  });

  habits.forEach((habit) => {
    items.push({
      title: habit,
      score: 75,
    });
  });

  return items.sort((a, b) => b.score - a.score);
}