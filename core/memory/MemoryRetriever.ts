import { memoryEngine } from "./index";
import type { MemoryEntry } from "./MemoryTypes";

const MAX_RESULTS = 8;

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function retrieveRelevantMemories(
  message: string,
): MemoryEntry[] {
  const words = new Set(normalize(message));

  return memoryEngine
    .getAll()
    .filter((memory) => {
      const searchable = normalize(
        `${memory.content} ${memory.tags.join(" ")}`,
      );

      return searchable.some((word) =>
        words.has(word),
      );
    })
    .sort(
      (a, b) =>
        b.importance - a.importance ||
        b.updatedAt - a.updatedAt,
    )
    .slice(0, MAX_RESULTS);
}