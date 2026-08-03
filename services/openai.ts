import {
  parseAuraAssistantPlan,
  type AuraAssistantPlan,
} from "@/core/actions";
import type { CognitiveRequest } from "@/core/brain";

interface ChatErrorResponse {
  error?: string;
}

export async function generateOpenAIResponse(
  request: CognitiveRequest,
): Promise<AuraAssistantPlan>;
export async function generateOpenAIResponse(
  prompt: string,
): Promise<AuraAssistantPlan>;
export async function generateOpenAIResponse(
  request: CognitiveRequest | string,
): Promise<AuraAssistantPlan> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      typeof request === "string"
        ? { prompt: request }
        : request,
    ),
  });

  const data =
    (await response.json()) as unknown;

  if (!response.ok) {
    const errorResponse =
      typeof data === "object" &&
      data !== null
        ? (data as ChatErrorResponse)
        : {};

    throw new Error(
      errorResponse.error ??
        "Unknown IAURA API error."
    );
  }

  return parseAuraAssistantPlan(data);
}
