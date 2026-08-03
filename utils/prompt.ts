export function buildPrompt(userContext?: string): string {
  const profileSection = userContext?.trim()
    ? `
Current profile:

${userContext.trim()}
`.trim()
    : "";

  return [
    `
Analyze the user's current profile and identify the most valuable next actions.
`.trim(),
    profileSection,
    `
Requested result:

- Analyze the user's current situation.
- Detect weaknesses.
- Detect strengths.
- Recommend the three highest-impact actions for today.
- Keep the response concise.
- Be practical.
- Encourage progress.
`.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}
