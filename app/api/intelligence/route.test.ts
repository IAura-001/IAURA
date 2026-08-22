import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  list: vi.fn(),
  projection: vi.fn(),
  create: vi.fn(),
  requireScope: vi.fn(),
}));

vi.mock("@/core/auth/session", () => ({
  getAuthenticatedUser: mocks.getUser,
  authenticationRequiredResponse: () => NextResponse.json({ error: "required" }, { status: 401 }),
}));
vi.mock("@/core/intelligence/server", () => ({
  listIntelligenceRecords: mocks.list,
  loadIntelligenceProjection: mocks.projection,
  createIntelligenceRecord: mocks.create,
  requireCurrentIntelligenceScope: mocks.requireScope,
}));

import { GET, POST } from "./route";

describe("/api/intelligence authority boundary", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ id: "user-a" });
    mocks.list.mockReset().mockResolvedValue([]);
    mocks.projection.mockReset().mockResolvedValue([]);
    mocks.create.mockReset().mockResolvedValue({ id: "record-a" });
    mocks.requireScope.mockReset().mockResolvedValue(undefined);
  });

  it("loads global plus only the exact requested owned project projection", async () => {
    const response = await GET(new NextRequest("http://localhost/api/intelligence?projectId=project-b"));
    expect(response.status).toBe(200);
    expect(mocks.projection).toHaveBeenCalledWith("user-a", "project-b");
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("derives record ownership from authentication, never request data", async () => {
    const input = { type: "goal", scopeType: "global", projectId: null, title: "Goal", targetDate: null, userId: "user-b" };
    const response = await POST(new Request("http://localhost/api/intelligence", {
      method: "POST",
      body: JSON.stringify({ record: input }),
    }));
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith("user-a", input);
    expect(mocks.requireScope).toHaveBeenCalledWith("user-a", "global", null, null);
  });

  it("requires authentication for reads and writes", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost/api/intelligence"))).status).toBe(401);
    expect((await POST(new Request("http://localhost/api/intelligence", { method: "POST", body: "{}" }))).status).toBe(401);
  });

  it("forwards trusted execution identity without accepting user ownership authority", async () => {
    const record = { type: "goal", scopeType: "global", projectId: null, title: "Goal", targetDate: null };
    const executionId = "70000000-0000-4000-8000-000000000001";
    const response = await POST(new Request("http://localhost/api/intelligence", {
      method: "POST", body: JSON.stringify({ record, executionId, operation: "intelligence_create_goal", userId: "user-b" }),
    }));
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith("user-a", record, executionId, "intelligence_create_goal");
  });

  it("preserves the requested project ID and validates its captured active-project authority", async () => {
    const record = { type: "goal", scopeType: "project", projectId: "project-a", title: "Goal A", targetDate: null };
    const response = await POST(new Request("http://localhost/api/intelligence", {
      method: "POST",
      body: JSON.stringify({ record, expectedActiveProjectId: "project-a" }),
    }));
    expect(response.status).toBe(201);
    expect(mocks.requireScope).toHaveBeenCalledWith("user-a", "project", "project-a", "project-a");
    expect(mocks.create).toHaveBeenCalledWith("user-a", record);
  });

  it("returns stale and performs zero writes when authoritative active project changed", async () => {
    mocks.requireScope.mockRejectedValueOnce(new Error("IAURA_INTELLIGENCE_STALE"));
    const record = { type: "goal", scopeType: "project", projectId: "project-a", title: "Goal A", targetDate: null };
    const response = await POST(new Request("http://localhost/api/intelligence", {
      method: "POST",
      body: JSON.stringify({ record, expectedActiveProjectId: "project-a" }),
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "IAURA_INTELLIGENCE_STALE" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
