import {
  parseAuraAssistantPlan,
  type AuraAssistantPlan,
} from "@/core/actions";

interface ChatErrorResponse {
  error?: string;
}

export async function generateOpenAIResponse(
  prompt: string
): Promise<AuraAssistantPlan> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
    }),
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
