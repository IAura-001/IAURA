import { describe, expect, it } from "vitest";

import {
  activeIntelligenceProjection,
  normalizeIntelligenceRecord,
  validatePriorityLimit,
  type IntelligenceRecord,
} from "../domain";

const now = "2026-08-21T12:00:00.000Z";

function goal(overrides: Partial<IntelligenceRecord> = {}): IntelligenceRecord {
  return {
    id: "goal-a",
    userId: "user-a",
    type: "goal",
    scopeType: "global",
    projectId: null,
    title: "Build the foundation",
    status: "active",
    targetDate: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as IntelligenceRecord;
}

describe("Intelligence v2 authority", () => {
  it("rejects global records carrying a projectId", () => {
    expect(normalizeIntelligenceRecord({
      ...goal(),
      projectId: "project-a",
    })).toBeNull();
  });

  it("rejects project records without a projectId", () => {
    expect(normalizeIntelligenceRecord({
      ...goal(),
      scopeType: "project",
    })).toBeNull();
  });

  it("keeps Project A intelligence out of Project B projection", () => {
    const records = [
      goal({ id: "global" }),
      goal({ id: "a", scopeType: "project", projectId: "project-a" }),
      goal({ id: "b", scopeType: "project", projectId: "project-b" }),
    ];

    expect(activeIntelligenceProjection(records, "project-b").map((item) => item.id))
      .toEqual(["global", "b"]);
  });

  it("includes global intelligence with or without an active project", () => {
    const records = [goal({ id: "global" })];
    expect(activeIntelligenceProjection(records, null)).toHaveLength(1);
    expect(activeIntelligenceProjection(records, "project-a")).toHaveLength(1);
  });

  it("excludes archived records from active projection", () => {
    expect(activeIntelligenceProjection([
      goal({ status: "archived" }),
    ], null)).toEqual([]);
  });

  it("enforces at most three active priorities per exact scope", () => {
    const priorities = [1, 2, 3, 4].map((position) => ({
      id: `priority-${position}`,
      userId: "user-a",
      type: "priority" as const,
      scopeType: "global" as const,
      projectId: null,
      title: `Priority ${position}`,
      status: "active" as const,
      goalId: null,
      position,
      createdAt: now,
      updatedAt: now,
    }));

    expect(validatePriorityLimit(priorities.slice(0, 3))).toBe(true);
    expect(validatePriorityLimit(priorities)).toBe(false);
  });
});
