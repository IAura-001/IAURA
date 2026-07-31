import type {
  ActionExecutionItem,
} from "./types";

export function formatActionReceipt(
  items: ActionExecutionItem[]
): string {
  const executedItems = items.filter(
    (item) => item.status === "executed"
  );
  const skippedItems = items.filter(
    (item) => item.status === "skipped"
  );

  if (
    executedItems.length === 0 &&
    skippedItems.length === 0
  ) {
    return "";
  }

  const sections: string[] = [];

  if (executedItems.length > 0) {
    sections.push(
      [
        "Acciones verificadas:",
        ...executedItems.map(
          (item) => `✓ ${item.summary}`
        ),
      ].join("\n")
    );
  }

  if (skippedItems.length > 0) {
    sections.push(
      [
        "Cambios no aplicados:",
        ...skippedItems.map(
          (item) =>
            `• ${item.summary}. ${item.reason}`
        ),
      ].join("\n")
    );
  }

  return sections.join("\n\n");
}
