import {
  LocalMemoryRepository,
  type MemoryRepository,
} from "./MemoryRepository";
import { MemoryScorer } from "./MemoryScorer";
import { MemoryType } from "./MemoryTypes";
import type { MemoryEntry } from "./MemoryTypes";

export class MemoryEngine {
  private scorer = new MemoryScorer();

  constructor(
    private readonly repository: MemoryRepository =
      new LocalMemoryRepository(),
  ) {}

  add(
    type: MemoryType,
    content: string,
    tags: string[] = [],
  ): MemoryEntry {
    const now = Date.now();
    const entry: MemoryEntry = {
      id: `${now}-${Math.random().toString(36).slice(2)}`,
      type,
      content,
      importance: this.scorer.score(type),
      createdAt: now,
      updatedAt: now,
      tags,
    };

    this.repository.upsertEntry(entry);
    return entry;
  }

  getAll(): MemoryEntry[] {
    return this.repository.getEntries();
  }

  getByType(type: MemoryType): MemoryEntry[] {
    return this.getAll().filter((entry) => entry.type === type);
  }

  search(query: string): MemoryEntry[] {
    const normalized = query.toLowerCase();

    return this.getAll().filter((memory) => {
      return (
        memory.content.toLowerCase().includes(normalized) ||
        memory.tags.some((tag) =>
          tag.toLowerCase().includes(normalized),
        )
      );
    });
  }

  count(): number {
    return this.repository.getEntries().length;
  }
}
