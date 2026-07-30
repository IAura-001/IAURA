import { MemoryType } from "./MemoryTypes";

export class MemoryScorer {
  score(type: MemoryType): number {
    switch (type) {
      case MemoryType.PROFILE:
        return 100;

      case MemoryType.GOAL:
        return 90;

      case MemoryType.HABIT:
        return 80;

      case MemoryType.PROJECT:
        return 85;

      case MemoryType.PREFERENCE:
        return 70;

      case MemoryType.CONVERSATION:
        return 50;

      default:
        return 10;
    }
  }
}