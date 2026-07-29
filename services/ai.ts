import { AI_MODELS, type AIModel } from "@/constants/ai";
export async function generateAIResponse(
  prompt: string,
  model: AIModel = AI_MODELS.DEFAULT
): Promise<string> {
  return `
[AI Provider Placeholder]

Model:
${model}

Prompt received:

${prompt}
`.trim();
}