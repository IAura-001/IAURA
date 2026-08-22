import type { IAuraProject } from "@/types/project";

import type { IntelligenceRecord } from "./domain";

export const INTELLIGENCE_CONTEXT_LIMITS = {
  directionsPerScope: 1,
  prioritiesPerScope: 3,
  goalsPerScope: 5,
  recurringCommitmentsPerScope: 5,
} as const;

export interface IntelligenceContextDirection {
  recordId: string;
  updatedAt: string;
  content: string;
}

export interface IntelligenceContextPriority {
  position: number;
  label: string;
  source: "title" | "goal";
  recordId: string;
  updatedAt: string;
  goalId: string | null;
}

export interface IntelligenceContextGoal {
  recordId: string;
  updatedAt: string;
  title: string;
  targetDate: string | null;
}

export interface IntelligenceContextRecurringCommitment {
  recordId: string;
  updatedAt: string;
  title: string;
  cadence: "daily" | "weekly" | "custom";
  cadenceDetail: string | null;
}

export interface IntelligenceContextScope {
  direction: IntelligenceContextDirection | null;
  priorities: IntelligenceContextPriority[];
  goals: IntelligenceContextGoal[];
  recurringCommitments: IntelligenceContextRecurringCommitment[];
}

export interface IntelligenceContextProjection {
  global: IntelligenceContextScope;
  project: (IntelligenceContextScope & {
    projectId: string;
    projectGoal: string;
  }) | null;
}

function emptyScope(): IntelligenceContextScope {
  return { direction: null, priorities: [], goals: [], recurringCommitments: [] };
}

function compareCreated(left: IntelligenceRecord, right: IntelligenceRecord): number {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function projectScope(records: IntelligenceRecord[]): IntelligenceContextScope {
  const active = records.filter((record) => record.status === "active");
  const activeGoals = active
    .filter((record): record is Extract<IntelligenceRecord, { type: "goal" }> => record.type === "goal")
    .sort(compareCreated);
  const goals = activeGoals.slice(0, INTELLIGENCE_CONTEXT_LIMITS.goalsPerScope);
  const goalTitles = new Map(activeGoals.map((goal) => [goal.id, goal.title]));

  return {
    direction: active
      .filter((record): record is Extract<IntelligenceRecord, { type: "direction" }> => record.type === "direction")
      .sort(compareCreated)
      .slice(0, INTELLIGENCE_CONTEXT_LIMITS.directionsPerScope)
      .map(({ id: recordId, updatedAt, content }) => ({ recordId, updatedAt, content }))[0] ?? null,
    priorities: active
      .filter((record): record is Extract<IntelligenceRecord, { type: "priority" }> => record.type === "priority")
      .sort((left, right) => left.position - right.position || compareCreated(left, right))
      .slice(0, INTELLIGENCE_CONTEXT_LIMITS.prioritiesPerScope)
      .flatMap((priority) => {
        const label = priority.title ?? (priority.goalId ? goalTitles.get(priority.goalId) : undefined);
        return label ? [{ position: priority.position, label, source: priority.title ? "title" as const : "goal" as const, recordId: priority.id, updatedAt: priority.updatedAt, goalId: priority.goalId }] : [];
      }),
    goals: goals.map(({ id: recordId, updatedAt, title, targetDate }) => ({ recordId, updatedAt, title, targetDate })),
    recurringCommitments: active
      .filter((record): record is Extract<IntelligenceRecord, { type: "recurring_commitment" }> => record.type === "recurring_commitment")
      .sort(compareCreated)
      .slice(0, INTELLIGENCE_CONTEXT_LIMITS.recurringCommitmentsPerScope)
      .map(({ id: recordId, updatedAt, title, cadence, cadenceDetail }) => ({ recordId, updatedAt, title, cadence, cadenceDetail })),
  };
}

export function emptyIntelligenceContextProjection(
  activeProject: IAuraProject | null,
): IntelligenceContextProjection {
  return {
    global: emptyScope(),
    project: activeProject
      ? { ...emptyScope(), projectId: activeProject.id, projectGoal: activeProject.goal }
      : null,
  };
}

export function buildIntelligenceContextProjection(
  records: IntelligenceRecord[],
  activeProject: IAuraProject | null,
): IntelligenceContextProjection {
  const globalRecords = records.filter((record) => record.scopeType === "global");
  const projectRecords = activeProject
    ? records.filter((record) => record.scopeType === "project" && record.projectId === activeProject.id)
    : [];

  return {
    global: projectScope(globalRecords),
    project: activeProject
      ? {
          ...projectScope(projectRecords),
          projectId: activeProject.id,
          projectGoal: activeProject.goal,
        }
      : null,
  };
}
