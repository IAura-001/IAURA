import { AI_MODELS, type AIModel } from "@/constants/ai";
export function generateAIResponse(
  prompt: string,
  model: AIModel = AI_MODELS.DEFAULT
): string {
  return `
[AI Provider Placeholder]

Model:
${model}

Prompt received:

${prompt}
`.trim();
}