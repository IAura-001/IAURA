import { describe, expect, it } from "vitest";

import type { IAuraProject } from "@/types/project";
import type { IntelligenceRecord } from "../domain";
import {
  buildIntelligenceContextProjection,
  INTELLIGENCE_CONTEXT_LIMITS,
} from "../contextProjection";

const projectA = { id: "project-a", goal: "Primary project objective" } as IAuraProject;

function record(
  id: string,
  type: IntelligenceRecord["type"],
  scopeType: "global" | "project",
  projectId: string | null,
  overrides: Record<string, unknown> = {},
): IntelligenceRecord {
  const base = {
    id,
    userId: "user-a",
    type,
    scopeType,
    projectId,
    createdAt: `2026-08-21T00:00:${id.padStart(2, "0")}Z`,
    updatedAt: "2026-08-21T01:00:00Z",
  };
  if (type === "direction") return { ...base, type, content: id, status: "active", ...overrides } as IntelligenceRecord;
  if (type === "goal") return { ...base, type, title: id, status: "active", targetDate: null, ...overrides } as IntelligenceRecord;
  if (type === "priority") return { ...base, type, title: id, status: "active", goalId: null, position: 1, ...overrides } as IntelligenceRecord;
  return { ...base, type, title: id, status: "active", cadence: "daily", cadenceDetail: null, ...overrides } as IntelligenceRecord;
}

describe("Intelligence context projection", () => {
  it("returns global context only without an active project", () => {
    const projection = buildIntelligenceContextProjection([
      record("global-goal", "goal", "global", null),
      record("project-goal", "goal", "project", "project-a"),
    ], null);

    expect(projection.global.goals.map((goal) => goal.title)).toEqual(["global-goal"]);
    expect(projection.project).toBeNull();
  });

  it("includes global plus exact project A and excludes project B, archived, paused and completed records", () => {
    const projection = buildIntelligenceContextProjection([
      record("global", "goal", "global", null),
      record("a", "goal", "project", "project-a"),
      record("b", "goal", "project", "project-b"),
      record("archived", "goal", "project", "project-a", { status: "archived" }),
      record("completed", "goal", "project", "project-a", { status: "completed" }),
      record("paused", "recurring_commitment", "project", "project-a", { status: "paused" }),
    ], projectA);

    expect(projection.global.goals.map((goal) => goal.title)).toEqual(["global"]);
    expect(projection.project?.goals.map((goal) => goal.title)).toEqual(["a"]);
    expect(projection.project?.recurringCommitments).toEqual([]);
    expect(projection.project?.projectGoal).toBe("Primary project objective");
  });

  it("enforces hard direction, priority, goal and commitment bounds deterministically", () => {
    const records: IntelligenceRecord[] = [
      ...Array.from({ length: 2 }, (_, index) => record(`d${index}`, "direction", "global", null)),
      ...Array.from({ length: 6 }, (_, index) => record(`p${index}`, "priority", "global", null, { position: (index % 3) + 1 })),
      ...Array.from({ length: 7 }, (_, index) => record(`g${index}`, "goal", "global", null)),
      ...Array.from({ length: 7 }, (_, index) => record(`r${index}`, "recurring_commitment", "global", null)),
    ];

    const scope = buildIntelligenceContextProjection(records, null).global;
    expect(scope.direction).toEqual({ content: "d0" });
    expect(scope.priorities).toHaveLength(INTELLIGENCE_CONTEXT_LIMITS.prioritiesPerScope);
    expect(scope.goals).toHaveLength(INTELLIGENCE_CONTEXT_LIMITS.goalsPerScope);
    expect(scope.recurringCommitments).toHaveLength(INTELLIGENCE_CONTEXT_LIMITS.recurringCommitmentsPerScope);
  });
});
