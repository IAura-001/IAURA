import type {
  ContextPackage,
  RetrievedContextItem,
} from "./ContextRetrievalTypes";

function sourceLabel(
  source: RetrievedContextItem["source"],
): string {
  switch (source) {
    case "conversation":
      return "Conversación reciente";
    case "memory":
      return "Memoria relevante";
    case "session":
      return "Sesión";
    case "system":
      return "Sistema";
  }
}

export function serializeContextPackage(
  contextPackage: ContextPackage,
): string {
  if (contextPackage.items.length === 0) {
    return "";
  }

  return contextPackage.items
    .map(
      (item) =>
        `[${sourceLabel(item.source)}] ${item.content}`,
    )
    .join("\n");
}

export function mergeUserContext(
  explicitContext: string,
  retrievedContext: string,
): string {
  return [
    explicitContext.trim(),
    retrievedContext.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}