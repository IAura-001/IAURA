import { memoryEngine } from "./index";
import type { MemoryEntry } from "./MemoryTypes";
import { MemoryType } from "./MemoryTypes";
import { getProjectScope } from "./ProjectMemoryScope";

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
  projectId?: string,
): MemoryEntry[] {
  const words = new Set(normalize(message));
  const trustedProjectId = projectId?.trim() || null;

  return memoryEngine
    .getAll()
    .filter((memory) => {
      const memoryProjectId = getProjectScope(memory.tags);

      if (memory.type === MemoryType.PROJECT) {
        return Boolean(
          trustedProjectId && memoryProjectId === trustedProjectId,
        );
      }

      return memoryProjectId === null;
    })
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
