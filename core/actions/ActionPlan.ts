import {
  AURA_EXPERIENCE_KINDS,
  AURA_EXPERIENCE_SURFACES,
  IAURA_ACTION_TYPES,
  IAURA_MEMORY_OPERATIONS,
  IAURA_MEMORY_TYPES,
  type AuraAssistantPlan,
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

  return {
    content,
    actions,
    memoryUpdates,
    experience: parseExperience(
      candidate.experience,
    ),
    ...(betaNextStep ? { betaNextStep } : {}),
  };
}
