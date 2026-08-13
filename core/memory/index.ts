export * from "./MemoryEngine";
export * from "./MemoryScorer";
export * from "./MemoryIndexer";
export * from "./MemoryTypes";
export * from "./MemoryRepository";
export * from "./MemoryIntelligence";
export * from "./ProjectMemoryScope";

import { MemoryEngine } from "./MemoryEngine";
import { memoryRepository } from "./MemoryRepository";

export const memoryEngine = new MemoryEngine(memoryRepository);
