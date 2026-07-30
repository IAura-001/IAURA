export enum MemoryType {
  PROFILE = "profile",
  GOAL = "goal",
  HABIT = "habit",
  PROJECT = "project",
  PREFERENCE = "preference",
  CONVERSATION = "conversation",
}
export interface MemoryEntry {
  id: string;
  tags: string[];
  type: MemoryType;
  content: string;
  importance: number;
  createdAt: number;
  updatedAt: number;
}