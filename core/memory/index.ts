export * from "./MemoryEngine";
export * from "./MemoryScorer";
export * from "./MemoryIndexer";
export * from "./MemoryTypes";
export * from "./MemoryRepository";
export * from "./MemoryIntelligence";

import { MemoryEngine } from "./MemoryEngine";
import { memoryRepository } from "./MemoryRepository";

export const memoryEngine = new MemoryEngine(memoryRepository);
