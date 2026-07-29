export type PriorityItem = {
  title: string;
  score: number;
};

export function generatePriorities(
  goals: string[],
  habits: string[]
): PriorityItem[] {
  const items: PriorityItem[] = [];

 goals.forEach((goal, index) => {
  items.push({
    title: goal,
    score: 100 - index * 5,
  });
});

habits.forEach((habit, index) => {
  items.push({
    title: habit,
    score: 75 - index * 5,
  });
});

  return items.sort((a, b) => b.score - a.score);
}