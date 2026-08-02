import {
  AURA_EXPERIENCE_KINDS,
  AURA_EXPERIENCE_SURFACES,
  IAURA_ACTION_TYPES,
  type AuraExperience,
  type AuraExperienceChoice,
  type AuraExperienceKind,
  type AuraExperiencePhase,
  type AuraExperienceSurface,
  type AuraAssistantPlan,
  type IAuraActionType,
  type PlannedAuraAction,
} from "./types";
import type { ProjectKind } from "@/types/project";

const actionTypes = new Set<string>(
  IAURA_ACTION_TYPES
);
const experienceKinds = new Set<string>(
  AURA_EXPERIENCE_KINDS
);
const experienceSurfaces = new Set<string>(
  AURA_EXPERIENCE_SURFACES
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
  maximumLength: number
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function parseAction(
  value: unknown
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
      1000
    ),
    goal: readText(candidate.goal, 500),
    missionId: readText(
      candidate.missionId,
      50
    ),
    projectKind:
      typeof candidate.projectKind === "string" &&
      projectKinds.has(candidate.projectKind)
        ? (candidate.projectKind as ProjectKind)
        : "general",
    reason: readText(candidate.reason, 300),
  };
}

function parsePhase(
  value: unknown
): AuraExperiencePhase | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const title = readText(candidate.title, 100);

  if (!title) return null;

  return {
    title,
    description: readText(candidate.description, 240),
  };
}

function parseChoice(
  value: unknown
): AuraExperienceChoice | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const label = readText(candidate.label, 80);
  const prompt = readText(candidate.prompt, 600);

  if (!label || !prompt) return null;

  return {
    label,
    description: readText(candidate.description, 220),
    prompt,
  };
}

function parseExperience(
  value: unknown
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

  const candidate = value as Record<string, unknown>;
  const kind =
    typeof candidate.kind === "string" &&
    experienceKinds.has(candidate.kind)
      ? (candidate.kind as AuraExperienceKind)
      : "general";
  const recommendedSurface =
    typeof candidate.recommendedSurface === "string" &&
    experienceSurfaces.has(candidate.recommendedSurface)
      ? (candidate.recommendedSurface as AuraExperienceSurface)
      : "none";
  const phases = Array.isArray(candidate.phases)
    ? candidate.phases
        .slice(0, 5)
        .map(parsePhase)
        .filter(
          (phase): phase is AuraExperiencePhase => phase !== null
        )
    : [];
  const choices = Array.isArray(candidate.choices)
    ? candidate.choices
        .slice(0, 4)
        .map(parseChoice)
        .filter(
          (choice): choice is AuraExperienceChoice => choice !== null
        )
    : [];

  return {
    kind,
    title: readText(candidate.title, 120),
    summary: readText(candidate.summary, 400),
    phases,
    choices,
    recommendedSurface,
  };
}

export function parseAuraAssistantPlan(
  value: unknown
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
      "IAURA returned an invalid action plan."
    );
  }

  const candidate = parsedValue as Record<
    string,
    unknown
  >;

  const content = readText(
    candidate.content,
    12000
  );

  if (!content) {
    throw new Error(
      "IAURA returned an empty response."
    );
  }

  const actions = Array.isArray(
    candidate.actions
  )
    ? candidate.actions
        .slice(0, 8)
        .map(parseAction)
        .filter(
          (
            action
          ): action is PlannedAuraAction =>
            action !== null
        )
    : [];

  return {
    content,
    actions,
    experience: parseExperience(candidate.experience),
  };
}
