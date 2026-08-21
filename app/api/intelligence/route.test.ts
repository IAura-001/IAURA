import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  list: vi.fn(),
  projection: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/core/auth/session", () => ({
  getAuthenticatedUser: mocks.getUser,
  authenticationRequiredResponse: () => NextResponse.json({ error: "required" }, { status: 401 }),
}));
vi.mock("@/core/intelligence/server", () => ({
  listIntelligenceRecords: mocks.list,
  loadIntelligenceProjection: mocks.projection,
  createIntelligenceRecord: mocks.create,
}));

import { GET, POST } from "./route";

describe("/api/intelligence authority boundary", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ id: "user-a" });
    mocks.list.mockReset().mockResolvedValue([]);
    mocks.projection.mockReset().mockResolvedValue([]);
    mocks.create.mockReset().mockResolvedValue({ id: "record-a" });
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
  });

  it("requires authentication for reads and writes", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost/api/intelligence"))).status).toBe(401);
    expect((await POST(new Request("http://localhost/api/intelligence", { method: "POST", body: "{}" }))).status).toBe(401);
  });
});
