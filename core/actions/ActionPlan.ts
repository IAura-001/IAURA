import {
  AURA_EXPERIENCE_KINDS,
  AURA_EXPERIENCE_SURFACES,
  IAURA_ACTION_TYPES,
  IAURA_MEMORY_OPERATIONS,
  IAURA_MEMORY_TYPES,
  type AuraAssistantPlan,
  type BetaExecutionEvaluation,
  type BetaIncompleteExecutionRecoveryDecision,
  type BetaPostClosureDecision,
  type BetaSessionEvaluation,
  type BetaNextStepRecommendation,
  type AuraExperience,
  type AuraExperienceChoice,
  type AuraExperienceKind,
  type AuraExperiencePhase,
  type AuraExperienceSurface,
  type IAuraActionType,
  type IAuraMemoryOperation,
  type IAuraMemoryType,
  type PlannedAuraAction,
  type PlannedMemoryUpdate,
} from "./types";
import type { ProjectKind } from "@/types/project";
import type { IntelligenceActionProposal, ProposalBase } from "@/core/intelligence/actionTypes";

const actionTypes = new Set<string>(
  IAURA_ACTION_TYPES,
);

const memoryOperations = new Set<string>(
  IAURA_MEMORY_OPERATIONS,
);

const memoryTypes = new Set<string>(
  IAURA_MEMORY_TYPES,
);

const experienceKinds = new Set<string>(
  AURA_EXPERIENCE_KINDS,
);

const experienceSurfaces = new Set<string>(
  AURA_EXPERIENCE_SURFACES,
);

const projectKinds = new Set<string>([
  "general",
  "personal",
  "business",
  "creative",
  "learning",
  "wellbeing",
]);

function readText(
  value: unknown,
  maximumLength: number,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function readStringArray(
  value: unknown,
  maximumItems: number,
  maximumItemLength: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, maximumItems)
    .map((item) =>
      readText(item, maximumItemLength),
    )
    .filter(Boolean);
}

function readConfidence(
  value: unknown,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function parseIntelligenceProposal(value: unknown, trustApplicationExecutionId = false): IntelligenceActionProposal | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  const scopeType = p.scopeType;
  const projectId = p.projectId;
  const expectedActiveProjectId = p.expectedActiveProjectId;
  if ((scopeType !== "global" && scopeType !== "project") ||
    (scopeType === "global" && (projectId !== null || expectedActiveProjectId !== null)) ||
    (scopeType === "project" && (typeof projectId !== "string" || !projectId.trim() || expectedActiveProjectId !== projectId))) return null;
  const base: ProposalBase = {
    ...(trustApplicationExecutionId && typeof p.executionId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.executionId)
      ? { executionId: p.executionId } : {}),
    scopeType,
    projectId: projectId as string | null,
    expectedActiveProjectId: expectedActiveProjectId as string | null,
    projectName: typeof p.projectName === "string" && p.projectName.trim() ? p.projectName.trim().slice(0, 200) : null,
    currentSummary: readText(p.currentSummary, 1000),
    proposedSummary: readText(p.proposedSummary, 1000),
  };
  if (!base.proposedSummary) return null;
  const validRecordId = (candidate: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate);
  const validUpdatedAt = (candidate: string) => Number.isFinite(Date.parse(candidate));
  const recordId = readText(p.recordId, 200);
  const expectedUpdatedAt = readText(p.expectedUpdatedAt, 100);
  if ((recordId && !validRecordId(recordId)) || (expectedUpdatedAt && !validUpdatedAt(expectedUpdatedAt))) return null;
  if (p.operation === "intelligence_set_direction") {
    const content = readText(p.content, 2000);
    if (!content || Boolean(recordId) !== Boolean(expectedUpdatedAt)) return null;
    return { ...base, operation: p.operation, recordId: recordId || null, expectedUpdatedAt: expectedUpdatedAt || null, content };
  }
  if (p.operation === "intelligence_create_goal") {
    const title = readText(p.title, 500); return title ? { ...base, operation: p.operation, title } : null;
  }
  if (p.operation === "intelligence_set_goal_status" && recordId && expectedUpdatedAt && (p.status === "completed" || p.status === "archived"))
    return { ...base, operation: p.operation, recordId, expectedUpdatedAt, status: p.status };
  if (p.operation === "intelligence_create_priority") {
    const title = readText(p.title, 500) || null; const goalId = readText(p.goalId, 200) || null;
    if (goalId && !validRecordId(goalId)) return null;
    return Boolean(title) !== Boolean(goalId) ? { ...base, operation: p.operation, title, goalId } : null;
  }
  if (p.operation === "intelligence_reorder_priorities" && Array.isArray(p.orderedPriorityIds) && Array.isArray(p.expectedPriorities)) {
    const ids = p.orderedPriorityIds.map((id) => readText(id, 200));
    const snapshot = p.expectedPriorities.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const row = item as Record<string, unknown>; const id = readText(row.recordId, 200); const updatedAt = readText(row.updatedAt, 100); const label = readText(row.label, 500);
      return id && updatedAt && label && Number.isInteger(row.position) && Number(row.position) >= 1 && Number(row.position) <= 3
        ? [{ recordId: id, position: Number(row.position), updatedAt, label }] : [];
    });
    const snapshotIds = snapshot.map((row) => row.recordId);
    const snapshotPositions = snapshot.map((row) => row.position);
    if (!ids.length || ids.some((id) => !id || !validRecordId(id)) || ids.length > 3 || new Set(ids).size !== ids.length ||
      snapshot.length !== ids.length || snapshot.some((row) => !validRecordId(row.recordId) || !validUpdatedAt(row.updatedAt)) ||
      new Set(snapshotIds).size !== snapshotIds.length || new Set(snapshotPositions).size !== snapshotPositions.length ||
      ids.some((id) => !snapshotIds.includes(id))) return null;
    return { ...base, operation: p.operation, orderedPriorityIds: ids, expectedPriorities: snapshot };
  }
  if (p.operation === "intelligence_archive_priority" && recordId && expectedUpdatedAt)
    return { ...base, operation: p.operation, recordId, expectedUpdatedAt };
  if (p.operation === "intelligence_create_recurring_commitment") {
    const title = readText(p.title, 500); const cadenceDetail = readText(p.cadenceDetail, 500) || null;
    if (!title || (p.cadence !== "daily" && p.cadence !== "weekly" && p.cadence !== "custom") || (p.cadence === "custom" && !cadenceDetail)) return null;
    return { ...base, operation: p.operation, title, cadence: p.cadence, cadenceDetail };
  }
  if (p.operation === "intelligence_set_recurring_commitment_status" && recordId && expectedUpdatedAt && (p.status === "active" || p.status === "paused" || p.status === "archived"))
    return { ...base, operation: p.operation, recordId, expectedUpdatedAt, status: p.status };
  return null;
}

function parseAction(
  value: unknown,
): PlannedAuraAction | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const candidate = value as Record<
    string,
    unknown
  >;

  if (
    typeof candidate.type !== "string" ||
    !actionTypes.has(candidate.type)
  ) {
    return null;
  }

  return {
    type: candidate.type as IAuraActionType,
    value: readText(candidate.value, 200),
    description: readText(
      candidate.description,
      1000,
    ),
    goal: readText(candidate.goal, 500),
    missionId: readText(
      candidate.missionId,
      50,
    ),
    projectKind:
      typeof candidate.projectKind === "string" &&
      projectKinds.has(candidate.projectKind)
        ? (candidate.projectKind as ProjectKind)
        : "general",
    reason: readText(
      candidate.reason,
      300,
    ),
  };
}

function parseMemoryUpdate(
  value: unknown,
): PlannedMemoryUpdate | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const candidate = value as Record<
    string,
    unknown
  >;

  if (
    typeof candidate.operation !== "string" ||
    !memoryOperations.has(
      candidate.operation,
    ) ||
    typeof candidate.type !== "string" ||
    !memoryTypes.has(candidate.type)
  ) {
    return null;
  }

  const content = readText(
    candidate.content,
    500,
  );

  const reason = readText(
    candidate.reason,
    300,
  );

  if (!content || !reason) {
    return null;
  }

  return {
    operation:
      candidate.operation as IAuraMemoryOperation,
    type: candidate.type as IAuraMemoryType,
    content,
    tags: readStringArray(
      candidate.tags,
      8,
      60,
    ),
    reason,
    confidence: readConfidence(
      candidate.confidence,
    ),
  };
}

function parsePhase(
  value: unknown,
): AuraExperiencePhase | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const candidate = value as Record<
    string,
    unknown
  >;

  const title = readText(
    candidate.title,
    100,
  );

  if (!title) {
    return null;
  }

  return {
    title,
    description: readText(
      candidate.description,
      240,
    ),
  };
}

function parseChoice(
  value: unknown,
): AuraExperienceChoice | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const candidate = value as Record<
    string,
    unknown
  >;

  const label = readText(
    candidate.label,
    80,
  );

  const prompt = readText(
    candidate.prompt,
    600,
  );

  if (!label || !prompt) {
    return null;
  }

  const rawConfirmation =
    typeof candidate.confirmation === "object" && candidate.confirmation !== null
      ? candidate.confirmation as Record<string, unknown>
      : null;
  const confirmation = (() => {
    if (rawConfirmation && rawConfirmation.kind === "intelligence-action" &&
      (rawConfirmation.decision === "confirm" || rawConfirmation.decision === "cancel")) {
      const proposal = parseIntelligenceProposal(rawConfirmation.proposal);
      return proposal ? { kind: "intelligence-action" as const, decision: rawConfirmation.decision as "confirm" | "cancel", proposal } : undefined;
    }
    if (!rawConfirmation) return undefined;
    if (rawConfirmation.kind === "project-decision") {
      const content = readText(rawConfirmation.content, 600);
      return content ? { kind: "project-decision" as const, content } : undefined;
    }
    if (rawConfirmation.kind === "beta-context") {
      const goal = readText(rawConfirmation.goal, 500);
      const blocker = readText(rawConfirmation.blocker, 500);
      const summary = readText(rawConfirmation.summary, 1000);
      return goal && blocker && summary
        ? { kind: "beta-context" as const, goal, blocker, summary }
        : undefined;
    }
    if (rawConfirmation.kind === "beta-outcome") {
      const outcome = readText(rawConfirmation.outcome, 1000);
      const doneWhen = readText(rawConfirmation.doneWhen, 1000);
      return outcome && doneWhen
        ? { kind: "beta-outcome" as const, outcome, doneWhen }
        : undefined;
    }
    if (rawConfirmation.kind === "beta-next-step") {
      const action = readText(rawConfirmation.action, 1000);
      const whyNow = readText(rawConfirmation.whyNow, 1000);
      const result = readText(rawConfirmation.result, 1000);
      const doneWhen = readText(rawConfirmation.doneWhen, 1000);
      return action && whyNow && result && doneWhen
        ? { kind: "beta-next-step" as const, action, whyNow, result, doneWhen }
        : undefined;
    }
    if (
      rawConfirmation.kind === "beta-session-decision" &&
      (rawConfirmation.decision === "start-now" ||
        rawConfirmation.decision === "continue-later")
    ) {
      return {
        kind: "beta-session-decision" as const,
        decision: rawConfirmation.decision as "start-now" | "continue-later",
      };
    }
    if (
      rawConfirmation.kind === "beta-execution-evaluation" &&
      (rawConfirmation.result === "passed" ||
        rawConfirmation.result === "failed" ||
        rawConfirmation.result === "partial") &&
      typeof rawConfirmation.doneWhenSatisfied === "boolean"
    ) {
      const observation = readText(rawConfirmation.observation, 2000);
      return observation
        ? {
            kind: "beta-execution-evaluation" as const,
            result: rawConfirmation.result as BetaExecutionEvaluation["result"],
            observation,
            doneWhenSatisfied: rawConfirmation.doneWhenSatisfied,
          }
        : undefined;
    }
    if (
      rawConfirmation.kind === "beta-incomplete-execution-recovery" &&
      (rawConfirmation.decision === "retry-now" ||
        rawConfirmation.decision === "retry-later")
    ) {
      return {
        kind: "beta-incomplete-execution-recovery" as const,
        decision: rawConfirmation.decision as BetaIncompleteExecutionRecoveryDecision,
      };
    }
    if (
      rawConfirmation.kind === "beta-session-evaluation" &&
      typeof rawConfirmation.outcomeSatisfied === "boolean"
    ) {
      const summary = readText(rawConfirmation.summary, 2000);
      return summary
        ? {
            kind: "beta-session-evaluation" as const,
            outcomeSatisfied: rawConfirmation.outcomeSatisfied,
            summary,
          }
        : undefined;
    }
    if (rawConfirmation.kind === "beta-session-closure") {
      return { kind: "beta-session-closure" as const };
    }
    if (
      rawConfirmation.kind === "beta-post-closure-handoff" &&
      (rawConfirmation.decision === "finish-here" ||
        rawConfirmation.decision === "begin-another-cycle")
    ) {
      return {
        kind: "beta-post-closure-handoff" as const,
        decision: rawConfirmation.decision as BetaPostClosureDecision,
      };
    }
    return undefined;
  })();

  return {
    label,
    description: readText(
      candidate.description,
      220,
    ),
    prompt,
    ...(confirmation ? { confirmation } : {}),
  };
}

function parseBetaExecutionEvaluation(
  value: unknown,
): BetaExecutionEvaluation | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.result !== "passed" &&
    candidate.result !== "failed" &&
    candidate.result !== "partial"
  ) {
    return null;
  }
  const observation = readText(candidate.observation, 2000);
  if (!observation || typeof candidate.doneWhenSatisfied !== "boolean") {
    return null;
  }
  return {
    result: candidate.result as BetaExecutionEvaluation["result"],
    observation,
    doneWhenSatisfied: candidate.doneWhenSatisfied,
  };
}

function parseBetaSessionEvaluation(
  value: unknown,
): BetaSessionEvaluation | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const summary = readText(candidate.summary, 2000);
  return typeof candidate.outcomeSatisfied === "boolean" && summary
    ? { outcomeSatisfied: candidate.outcomeSatisfied, summary }
    : null;
}

function parseExperience(
  value: unknown,
): AuraExperience {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return {
      kind: "general",
      title: "",
      summary: "",
      phases: [],
      choices: [],
      recommendedSurface: "none",
    };
  }

  const candidate = value as Record<
    string,
    unknown
  >;

  const kind =
    typeof candidate.kind === "string" &&
    experienceKinds.has(candidate.kind)
      ? (candidate.kind as AuraExperienceKind)
      : "general";

  const recommendedSurface =
    typeof candidate.recommendedSurface ===
      "string" &&
    experienceSurfaces.has(
      candidate.recommendedSurface,
    )
      ? (candidate.recommendedSurface as AuraExperienceSurface)
      : "none";

  const phases = Array.isArray(
    candidate.phases,
  )
    ? candidate.phases
        .slice(0, 5)
        .map(parsePhase)
        .filter(
          (
            phase,
          ): phase is AuraExperiencePhase =>
            phase !== null,
        )
    : [];

  const choices = Array.isArray(
    candidate.choices,
  )
    ? candidate.choices
        .slice(0, 4)
        .map(parseChoice)
        .filter(
          (
            choice,
          ): choice is AuraExperienceChoice =>
            choice !== null,
        )
    : [];

  return {
    kind,
    title: readText(
      candidate.title,
      120,
    ),
    summary: readText(
      candidate.summary,
      400,
    ),
    phases,
    choices,
    recommendedSurface,
  };
}

function parseBetaNextStep(
  value: unknown,
): BetaNextStepRecommendation | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const action = readText(candidate.action, 1000);
  const whyNow = readText(candidate.whyNow, 1000);
  const result = readText(candidate.result, 1000);
  const doneWhen = readText(candidate.doneWhen, 1000);

  return action && whyNow && result && doneWhen
    ? { action, whyNow, result, doneWhen }
    : undefined;
}

export function parseAuraAssistantPlan(
  value: unknown,
): AuraAssistantPlan {
  const parsedValue =
    typeof value === "string"
      ? (JSON.parse(value) as unknown)
      : value;

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null
  ) {
    throw new Error(
      "IAURA returned an invalid action plan.",
    );
  }

  const candidate = parsedValue as Record<
    string,
    unknown
  >;

  const content = readText(
    candidate.content,
    12000,
  );

  if (!content) {
    throw new Error(
      "IAURA returned an empty response.",
    );
  }

  const actions = Array.isArray(
    candidate.actions,
  )
    ? candidate.actions
        .slice(0, 8)
        .map(parseAction)
        .filter(
          (
            action,
          ): action is PlannedAuraAction =>
            action !== null,
        )
    : [];

  const memoryUpdates = Array.isArray(
    candidate.memoryUpdates,
  )
    ? candidate.memoryUpdates
        .slice(0, 6)
        .map(parseMemoryUpdate)
        .filter(
          (
            update,
          ): update is PlannedMemoryUpdate =>
            update !== null,
        )
    : [];

  const betaNextStep = parseBetaNextStep(candidate.betaNextStep);
  const betaExecutionEvaluation = parseBetaExecutionEvaluation(
    candidate.betaExecutionEvaluation,
  );
  const betaSessionEvaluation = parseBetaSessionEvaluation(
    candidate.betaSessionEvaluation,
  );

  return {
    content,
    actions,
    memoryUpdates,
    experience: parseExperience(
      candidate.experience,
    ),
    ...(betaNextStep ? { betaNextStep } : {}),
    ...(betaExecutionEvaluation ? { betaExecutionEvaluation } : {}),
    ...(betaSessionEvaluation ? { betaSessionEvaluation } : {}),
  };
}
