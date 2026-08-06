import type { Memory } from "@/types/memory";
import type { ProjectKind } from "@/types/project";
import type {
  ProjectRepositorySnapshot,
} from "@/core/project/ProjectRepository";

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

export const IAURA_MEMORY_TYPES = [
  "profile",
  "goal",
  "habit",
  "project",
  "preference",
] as const;

export type IAuraMemoryType =
  (typeof IAURA_MEMORY_TYPES)[number];

export const IAURA_MEMORY_OPERATIONS = [
  "remember",
] as const;

export type IAuraMemoryOperation =
  (typeof IAURA_MEMORY_OPERATIONS)[number];

export const AURA_EXPERIENCE_KINDS = [
  "personal-goal",
  "project",
  "brand",
  "creative",
  "learning",
  "wellbeing",
  "decision",
  "general",
] as const;

export type AuraExperienceKind =
  (typeof AURA_EXPERIENCE_KINDS)[number];

export const AURA_EXPERIENCE_SURFACES = [
  "none",
  "presence",
  "projects",
  "intelligence",
  "creative-direction",
  "creative-image",
  "creative-website",
  "creative-library",
  "launch",
] as const;

export type AuraExperienceSurface =
  (typeof AURA_EXPERIENCE_SURFACES)[number];

export interface AuraExperiencePhase {
  title: string;
  description: string;
}

export interface AuraExperienceChoice {
  label: string;
  description: string;
  prompt: string;
}

export interface AuraExperience {
  kind: AuraExperienceKind;
  title: string;
  summary: string;
  phases: AuraExperiencePhase[];
  choices: AuraExperienceChoice[];
  recommendedSurface: AuraExperienceSurface;
}

export interface PlannedAuraAction {
  type: IAuraActionType;
  value: string;
  description: string;
  goal: string;
  missionId: string;
  projectKind?: ProjectKind;
  reason: string;
}



export interface PlannedMemoryUpdate {
  operation: IAuraMemoryOperation;
  type: IAuraMemoryType;
  content: string;
  tags: string[];
  reason: string;
  confidence: number;
}

export interface AuraAssistantPlan {
  content: string;
  actions: PlannedAuraAction[];
  memoryUpdates: PlannedMemoryUpdate[];
  experience: AuraExperience;
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
  projectStateBefore?: ProjectRepositorySnapshot;
  projectStateAfter?: ProjectRepositorySnapshot;
  projectRevisionBefore?: number;
  projectRevisionAfter?: number;
  memoryRevisionBefore?: number;
  memoryRevisionAfter?: number;
}