import type {
  PlannedMemoryUpdate,
} from "@/core/actions";

import {
  MemoryType,
  memoryEngine,
  type MemoryEntry,
} from "@/core/memory";

export interface MemoryExecutionItem {
  status: "remembered" | "skipped";
  content: string;
  reason: string;
  memoryId?: string;
}

export interface MemoryExecutionResult {
  items: MemoryExecutionItem[];
  remembered: MemoryEntry[];
}

const MINIMUM_CONFIDENCE = 0.8;

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function mapMemoryType(
  type: PlannedMemoryUpdate["type"],
): MemoryType {
  switch (type) {
    case "profile":
      return MemoryType.PROFILE;

    case "goal":
      return MemoryType.GOAL;

    case "habit":
      return MemoryType.HABIT;

    case "project":
      return MemoryType.PROJECT;

    case "preference":
      return MemoryType.PREFERENCE;

    default: {
      const exhaustiveCheck: never = type;

      throw new Error(
        `Unsupported memory type: ${String(
          exhaustiveCheck,
        )}`,
      );
    }
  }
}

function isDuplicate(
  proposal: PlannedMemoryUpdate,
  existing: MemoryEntry[],
): boolean {
  const normalizedProposal = normalizeText(
    proposal.content,
  );

  return existing.some((entry) => {
    return (
      entry.type ===
        mapMemoryType(proposal.type) &&
      normalizeText(entry.content) ===
        normalizedProposal
    );
  });
}

export function executeMemoryUpdates(
  updates: PlannedMemoryUpdate[] = [],
): MemoryExecutionResult {
  const remembered: MemoryEntry[] = [];
  const items: MemoryExecutionItem[] = [];

  for (const update of updates.slice(0, 6)) {
    if (
      update.operation !== "remember"
    ) {
      items.push({
        status: "skipped",
        content: update.content,
        reason:
          "Unsupported memory operation.",
      });

      continue;
    }

    if (
      update.confidence <
      MINIMUM_CONFIDENCE
    ) {
      items.push({
        status: "skipped",
        content: update.content,
        reason:
          "Memory confidence was too low.",
      });

      continue;
    }

    const content =
      update.content.trim();

    if (!content) {
      items.push({
        status: "skipped",
        content: "",
        reason:
          "Memory content was empty.",
      });

      continue;
    }

    const existing = [
      ...memoryEngine.getAll(),
      ...remembered,
    ];

    if (isDuplicate(update, existing)) {
      items.push({
        status: "skipped",
        content,
        reason:
          "An equivalent memory already exists.",
      });

      continue;
    }

    const entry = memoryEngine.add(
      mapMemoryType(update.type),
      content,
      update.tags,
    );

    remembered.push(entry);

    items.push({
      status: "remembered",
      content,
      reason: update.reason,
      memoryId: entry.id,
    });
  }

  return {
    items,
    remembered,
  };
}