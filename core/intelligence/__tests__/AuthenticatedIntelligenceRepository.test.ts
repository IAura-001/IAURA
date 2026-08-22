import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthenticatedIntelligenceRepository } from "../AuthenticatedIntelligenceRepository";

const record = {
  id: "goal-a",
  userId: "user-a",
  type: "goal" as const,
  scopeType: "global" as const,
  projectId: null,
  title: "Canonical goal",
  status: "active" as const,
  targetDate: null,
  createdAt: "2026-08-21T12:00:00.000Z",
  updatedAt: "2026-08-21T12:00:00.000Z",
};

describe("AuthenticatedIntelligenceRepository", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reloads durable records through authenticated fetch without localStorage", async () => {
    const getItem = vi.spyOn(window.localStorage, "getItem");
    const setItem = vi.spyOn(window.localStorage, "setItem");
    const fetchMock = vi.fn().mockImplementation(async () => new Response(
      JSON.stringify({ records: [record] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const first = new AuthenticatedIntelligenceRepository();
    const second = new AuthenticatedIntelligenceRepository();

    expect(await first.loadAll()).toEqual([record]);
    expect(await second.loadAll()).toEqual([record]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("uses stable IDs for archive writes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ record: { ...record, status: "archived" } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await new AuthenticatedIntelligenceRepository().archive("goal-a");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/intelligence/goal-a",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("sends trusted execution identity with an idempotent create", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ record }), { status: 201, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    await new AuthenticatedIntelligenceRepository().create(
      { type: "goal", scopeType: "global", projectId: null, title: "Canonical goal", targetDate: null },
      "70000000-0000-4000-8000-000000000001",
      "intelligence_create_goal",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      executionId: "70000000-0000-4000-8000-000000000001",
      operation: "intelligence_create_goal",
    });
  });

  it("loads context through the authenticated exact-project projection endpoint", async () => {
    const project = { id: "project-a", goal: "Primary objective" } as Parameters<
      AuthenticatedIntelligenceRepository["loadContextProjection"]
    >[0];
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ records: [record] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const projection = await new AuthenticatedIntelligenceRepository()
      .loadContextProjection(project);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/intelligence?projectId=project-a",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(projection.global.goals[0]?.title).toBe("Canonical goal");
    expect(projection.project?.projectGoal).toBe("Primary objective");
  });
});
