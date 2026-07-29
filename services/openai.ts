interface ChatResponse {
  content?: string;
  error?: string;
}

export async function generateOpenAIResponse(
  prompt: string
): Promise<string> {
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
    (await response.json()) as ChatResponse;

  if (!response.ok) {
    throw new Error(
      data.error ??
        "Unknown IAURA API error."
    );
  }

  return data.content ?? "";
}