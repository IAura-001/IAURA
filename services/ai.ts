import { buildProjectMemoryContext } from "@/core/context/ContextBuilder";
import { projectEngine } from "@/core/project/ProjectEngine";

interface IAuraApiResponse {
  content?: unknown;
  error?: unknown;
  code?: unknown;
}

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

function buildInstructions(): string {
  const project = projectEngine.getCurrentProject();
  const projectMemory = buildProjectMemoryContext(project);

  return `
Eres IAURA, una inteligencia creativa centrada en proyectos.

Debes responder de forma clara, precisa, útil y específica.
Utiliza la memoria del proyecto como fuente principal de contexto.
Prioriza las decisiones y piezas aprobadas sobre los borradores.
No inventes información que no esté disponible.
No uses markdown, asteriscos, encabezados con numerales ni símbolos decorativos.

Memoria actual del proyecto:

${
  projectMemory ||
  "No existe memoria adicional disponible para este proyecto."
}
  `.trim();
}

export async function generateAIResponse(
  prompt: string,
): Promise<string> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    throw new Error("IAURA requires a non-empty prompt.");
  }

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      prompt: cleanPrompt,
      instructions: buildInstructions(),
    }),
  });

  const data = (await response.json()) as IAuraApiResponse;

  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : "IAURA could not generate a response.";

    throw new Error(message);
  }

  if (typeof data.content !== "string" || !data.content.trim()) {
    throw new Error(
      "IAURA returned an invalid response.",
    );
  }

  return sanitizeAuraResponse(data.content);
}