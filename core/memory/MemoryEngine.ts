import { MemoryIndexer } from "./MemoryIndexer";
import { MemoryScorer } from "./MemoryScorer";
import { MemoryType } from "./MemoryTypes";
import type { MemoryEntry } from "./MemoryTypes";

export class MemoryEngine {
  private memories: MemoryEntry[] = [];
  private scorer = new MemoryScorer();
private indexer = new MemoryIndexer();
add(
  type: MemoryType,
  content: string,
  tags: string[] = []
) {
    
  const entry: MemoryEntry = {
    id: crypto.randomUUID(),
    type,
    content,
    importance: this.scorer.score(type),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags,
  };

  this.memories.push(entry);
  this.indexer.add(entry);

  return entry;
}
  getAll() {
    return this.memories;
  }
  getByType(type: MemoryType) {
  return this.indexer.get(type);
}
search(query: string): MemoryEntry[] {
  const normalized = query.toLowerCase();

  return this.memories.filter((memory) => {
    return (
      memory.content.toLowerCase().includes(normalized) ||
      memory.tags.some((tag) =>
        tag.toLowerCase().includes(normalized)
      )
    );
  });
}count() {
  return this.memories.length;
}
}