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
  confirmation?: AuraExperienceConfirmation;
}

export type BetaExecutionResult = "passed" | "failed" | "partial";

export type BetaIncompleteExecutionRecoveryDecision =
  | "retry-now"
  | "retry-later";

export interface BetaExecutionEvaluation {
  result: BetaExecutionResult;
  observation: string;
  doneWhenSatisfied: boolean;
}

export interface BetaSessionEvaluation {
  outcomeSatisfied: boolean;
  summary: string;
}

export type BetaPostClosureDecision =
  | "finish-here"
  | "begin-another-cycle";

export type AuraExperienceConfirmation =
  | {
      kind: "project-decision";
      content: string;
    }
  | {
      kind: "beta-context";
      goal: string;
      blocker: string;
      summary: string;
    }
  | {
      kind: "beta-outcome";
      outcome: string;
      doneWhen: string;
    }
  | {
      kind: "beta-next-step";
      action: string;
      whyNow: string;
      result: string;
      doneWhen: string;
    }
  | {
      kind: "beta-session-decision";
      decision: "start-now" | "continue-later";
    }
  | {
      kind: "beta-execution-evaluation";
      result: BetaExecutionResult;
      observation: string;
      doneWhenSatisfied: boolean;
    }
  | {
      kind: "beta-incomplete-execution-recovery";
      decision: BetaIncompleteExecutionRecoveryDecision;
    }
  | {
      kind: "beta-session-evaluation";
      outcomeSatisfied: boolean;
      summary: string;
    }
  | {
      kind: "beta-session-closure";
    }
  | {
      kind: "beta-post-closure-handoff";
      decision: BetaPostClosureDecision;
    };

export interface AuraExperience {
  kind: AuraExperienceKind;
  title: string;
  summary: string;
  phases: AuraExperiencePhase[];
  choices: AuraExperienceChoice[];
  recommendedSurface: AuraExperienceSurface;
}

export interface BetaNextStepRecommendation {
  action: string;
  whyNow: string;
  result: string;
  doneWhen: string;
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
  betaNextStep?: BetaNextStepRecommendation;
  betaExecutionEvaluation?: BetaExecutionEvaluation;
  betaSessionEvaluation?: BetaSessionEvaluation;
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
  /** Undefined identifies a legacy entry whose project scope is unknown. */
  projectId?: string | null;
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
