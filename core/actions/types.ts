import type { Memory } from "@/types/memory";

export const IAURA_ACTION_TYPES = [
  "add_goal",
  "remove_goal",
  "add_habit",
  "remove_habit",
  "set_user_name",
  "create_project",
  "complete_mission",
] as const;

export type IAuraActionType =
  (typeof IAURA_ACTION_TYPES)[number];

export interface PlannedAuraAction {
  type: IAuraActionType;
  value: string;
  description: string;
  goal: string;
  missionId: string;
  reason: string;
}

export interface AuraAssistantPlan {
  content: string;
  actions: PlannedAuraAction[];
}

export interface ActionExecutionItem {
  type: IAuraActionType;
  status: "executed" | "skipped";
  summary: string;
  reason: string;
}

export interface ActionExecutionResult {
  memory: Memory;
  items: ActionExecutionItem[];
}

export interface AuraActionHistoryEntry {
  id: string;
  createdAt: string;
  status: "completed" | "undone";
  summaries: string[];
  before: Memory;
  after: Memory;
}
