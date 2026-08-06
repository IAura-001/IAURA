import {
  parseAuraAssistantPlan,
  type AuraAssistantPlan,
} from "@/core/actions";
import type {
  CognitiveRequest,
} from "@/core/brain";

interface CognitiveErrorResponse {
  error?: unknown;
}

export async function generateCognitiveResponse(
  request: CognitiveRequest,
): Promise<AuraAssistantPlan> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  const data = (await response.json()) as unknown;

  if (!response.ok) {
    const errorResponse =
      typeof data === "object" && data !== null
        ? (data as CognitiveErrorResponse)
        : {};

    throw new Error(
      typeof errorResponse.error === "string"
        ? errorResponse.error
        : "Unknown IAURA cognitive API error.",
    );
  }

  return parseAuraAssistantPlan(data);
}