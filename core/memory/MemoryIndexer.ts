import type { MemoryEntry } from "./MemoryTypes";

export class MemoryIndexer {
  private index = new Map<string, MemoryEntry[]>();

  add(entry: MemoryEntry) {
    const key = entry.type;

    if (!this.index.has(key)) {
      this.index.set(key, []);
    }

    this.index.get(key)!.push(entry);
  }

  get(type: string): MemoryEntry[] {
    return this.index.get(type) ?? [];
  }

  clear() {
    this.index.clear();
  }
}