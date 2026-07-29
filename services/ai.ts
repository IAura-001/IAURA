export async function generateAIResponse(
  prompt: string
): Promise<string> {
  return `
[AI Provider Placeholder]

Prompt received:

${prompt}
`.trim();
}