import { describe, expect, it, vi } from "vitest";
import { IntelligenceActionExecutor } from "../IntelligenceActionExecutor";
import type { IntelligenceActionProposal } from "../actionTypes";
import type { IntelligenceRecord } from "../domain";
import type { IAuraProject } from "@/types/project";

const base = {
  executionId: "70000000-0000-4000-8000-000000000001",
  scopeType: "global" as const, projectId: null, expectedActiveProjectId: null,
  projectName: null, currentSummary: "None", proposedSummary: "Goal: Finish v2",
};
const goal: IntelligenceRecord = {
  id: "goal-a", userId: "user-a", type: "goal", scopeType: "global", projectId: null,
  title: "Finish v2", status: "active", targetDate: null,
  createdAt: "2026-08-21T00:00:00Z", updatedAt: "2026-08-21T01:00:00Z",
};

function repository(records: IntelligenceRecord[] = []) {
  return {
    loadProjection: vi.fn().mockResolvedValue(records),
    create: vi.fn().mockResolvedValue(goal),
    update: vi.fn().mockResolvedValue(goal),
    reorderPriorities: vi.fn().mockResolvedValue([]),
  };
}

describe("IntelligenceActionExecutor", () => {
  it("creates exactly once through authenticated persistence and refreshes canonical context", async () => {
    const repo = repository();
    const proposal: IntelligenceActionProposal = { ...base, operation: "intelligence_create_goal", title: "Finish v2" };
    const result = await new IntelligenceActionExecutor(repo).execute(proposal, "source-a", null);
    expect(result.status).toBe("executed");
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.loadProjection).toHaveBeenCalledTimes(2);
  });

  it("reports a verified write as executed when only the post-write refresh fails", async () => {
    const repo = repository();
    repo.loadProjection
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("refresh unavailable"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const proposal: IntelligenceActionProposal = { ...base, operation: "intelligence_create_goal", title: "Finish v2" };

    const result = await new IntelligenceActionExecutor(repo).execute(proposal, "source-a", null);

    expect(result.status).toBe("executed");
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      "Intelligence mutation succeeded, but canonical context refresh failed.",
      "refresh unavailable",
    );
  });

  it("rejects a project proposal after active project changes", async () => {
    const repo = repository();
    const proposal: IntelligenceActionProposal = {
      ...base, operation: "intelligence_create_goal", title: "A goal",
      scopeType: "project", projectId: "project-a", expectedActiveProjectId: "project-a", projectName: "A",
    };
    const result = await new IntelligenceActionExecutor(repo).execute(proposal, "source-a", { id: "project-b" } as IAuraProject);
    expect(result.status).toBe("stale");
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("never substitutes the current project and forwards the captured Project A authority", async () => {
    const repo = repository();
    const proposal: IntelligenceActionProposal = {
      ...base, operation: "intelligence_create_goal", title: "A goal",
      scopeType: "project", projectId: "project-a", expectedActiveProjectId: "project-a", projectName: "Renamed A",
    };
    const result = await new IntelligenceActionExecutor(repo).execute(proposal, "source-a", { id: "project-a", name: "Different display name" } as IAuraProject);
    expect(result.status).toBe("executed");
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ scopeType: "project", projectId: "project-a" }),
      proposal.executionId,
      proposal.operation,
      "project-a",
    );
  });

  it("allows A to B to A only when the captured A authority is current again", async () => {
    const repo = repository();
    const proposal: IntelligenceActionProposal = {
      ...base, operation: "intelligence_create_goal", title: "A goal",
      scopeType: "project", projectId: "project-a", expectedActiveProjectId: "project-a", projectName: "Old A name",
    };
    const executor = new IntelligenceActionExecutor(repo);

    const stale = await executor.execute(proposal, "source-a", { id: "project-b" } as IAuraProject);
    expect(stale.status).toBe("stale");
    expect(repo.create).not.toHaveBeenCalled();

    const executed = await executor.execute(proposal, "source-a", { id: "project-a" } as IAuraProject);
    expect(executed.status).toBe("executed");
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project-a" }), proposal.executionId, proposal.operation, "project-a");
  });

  it("requires matching stable ID and updatedAt for status changes", async () => {
    const repo = repository([goal]);
    const proposal: IntelligenceActionProposal = {
      ...base, operation: "intelligence_set_goal_status", recordId: "goal-a",
      expectedUpdatedAt: "stale", status: "archived", proposedSummary: "Archive Finish v2",
    };
    const result = await new IntelligenceActionExecutor(repo).execute(proposal, "source-a", null);
    expect(result.status).toBe("stale");
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("rejects a fourth active priority honestly", async () => {
    const priorities = [1, 2, 3].map((position) => ({
      id: `p${position}`, userId: "user-a", type: "priority" as const, scopeType: "global" as const,
      projectId: null, title: `P${position}`, goalId: null, status: "active" as const, position,
      createdAt: "2026-08-21T00:00:00Z", updatedAt: "2026-08-21T01:00:00Z",
    }));
    const repo = repository(priorities);
    repo.create.mockRejectedValueOnce(new Error("IAURA_INTELLIGENCE_PRIORITY_LIMIT"));
    const proposal: IntelligenceActionProposal = { ...base, operation: "intelligence_create_priority", title: "P4", goalId: null, proposedSummary: "P4" };
    const result = await new IntelligenceActionExecutor(repo).execute(proposal, "source-a", null);
    expect(result.status).toBe("failed");
    expect(result.summary).toContain("three active priorities");
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it("requires the exact priority snapshot before transactional reorder", async () => {
    const priority = {
      id: "p1", userId: "user-a", type: "priority" as const, scopeType: "global" as const,
      projectId: null, title: "P1", goalId: null, status: "active" as const, position: 1,
      createdAt: "2026-08-21T00:00:00Z", updatedAt: "2026-08-21T01:00:00Z",
    };
    const repo = repository([priority]);
    const proposal: IntelligenceActionProposal = {
      ...base, operation: "intelligence_reorder_priorities", orderedPriorityIds: ["p1"],
      expectedPriorities: [{ recordId: "p1", position: 1, updatedAt: "stale", label: "P1" }], proposedSummary: "P1 first",
    };
    const result = await new IntelligenceActionExecutor(repo).execute(proposal, "source-a", null);
    expect(result.status).toBe("stale");
    expect(repo.reorderPriorities).not.toHaveBeenCalled();
  });
});
