import { iauraBrain } from "@/core/brain";
import { generateOpenAIResponse } from "@/services/openai";

export function sanitizeAuraResponse(value: string): string {
  return value
    .replace(/```(?:[a-zA-Z0-9_-]+)?\s*/g, "")
    .replace(/```/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^ {0,3}#{1,6}\s*/gm, "")
    .replace(/^ {0,3}>\s?/gm, "")
    .replace(/^ {0,3}[-*+]\s+/gm, "")
    .replace(/^ {0,3}[•◦▪▫]\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*\|?[-:]+(?:\|[-:]+)+\|?\s*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function generateAIResponse(
  prompt: string,
  userContext?: string,
): Promise<string> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    throw new Error("IAURA requires a non-empty prompt.");
  }

  const brainResult = iauraBrain.analyze({
    message: cleanPrompt,
    userContext: userContext?.trim() ?? "",
  });

  const response = await generateOpenAIResponse({
    originalUserMessage: brainResult.originalUserMessage,
    structuredContext: brainResult.structuredContext,
    compiledPrompt: brainResult.compiledPrompt,
  });

  return sanitizeAuraResponse(response.content);
}
