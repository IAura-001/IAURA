import {
  IAURA_ACTION_TYPES,
  type AuraAssistantPlan,
  type IAuraActionType,
  type PlannedAuraAction,
} from "./types";

const actionTypes = new Set<string>(
  IAURA_ACTION_TYPES
);

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
    reason: readText(candidate.reason, 300),
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
  };
}
