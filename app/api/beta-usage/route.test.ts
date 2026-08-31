import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
  getFounderUsage: vi.fn(),
}));

vi.mock("@/core/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/core/auth/session")>("@/core/auth/session");
  return { ...actual, getAuthenticatedUser: mocks.getUser };
});
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createClient }));
vi.mock("@/core/betaUsage/server", async () => {
  const founder = await import("@/core/betaUsage/founder");
  return { FounderUsageAccessError: founder.FounderUsageAccessError,
    getFounderBetaUsage: mocks.getFounderUsage };
});

import { GET, POST } from "./route";
import { FounderUsageAccessError } from "@/core/betaUsage/founder";

function client(rpcError: unknown = null, projectOwner = true) {
  const rpc = vi.fn().mockResolvedValue({ data: !rpcError, error: rpcError });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: projectOwner ? { id: "project-a" } : null,
    error: null,
  });
  const projectQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle };
  projectQuery.select.mockReturnValue(projectQuery);
  projectQuery.eq.mockReturnValue(projectQuery);
  const from = vi.fn(() => projectQuery);
  return { from, rpc };
}

describe("POST /api/beta-usage", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ id: "user-a" });
    mocks.createClient.mockReset();
    mocks.getFounderUsage.mockReset();
  });

  it("returns founder operations for an authenticated founder", async () => {
    mocks.getFounderUsage.mockResolvedValue({ summary: { totalRegistered: 1 }, users: [] });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ summary: { totalRegistered: 1 } });
  });

  it("denies a normal authenticated user even if client state claims founder", async () => {
    mocks.getFounderUsage.mockRejectedValue(new FounderUsageAccessError());
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("denies an unauthenticated user without querying founder data", async () => {
    mocks.getUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.getFounderUsage).not.toHaveBeenCalled();
  });

  it("binds the event to the authenticated user and stores no message content", async () => {
    const supabase = client();
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/beta-usage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "message_sent", projectId: "project-a", userId: "user-b", message: "private text" }),
    }));

    expect(response.status).toBe(202);
    expect(supabase.rpc).toHaveBeenCalledWith("record_product_funnel_event", expect.objectContaining({
      p_event_type: "message_sent", p_project_id: "project-a", p_metadata: {},
    }));
    expect(JSON.stringify(supabase.rpc.mock.calls[0][1])).not.toContain("private text");
  });

  it("rejects a project that is not owned by the authenticated user", async () => {
    const supabase = client(null, false);
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/beta-usage", {
      method: "POST", body: JSON.stringify({ type: "project_opened", projectId: "project-b" }),
    }));
    expect(response.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("records general IAURA usage without inventing a project scope", async () => {
    const supabase = client();
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/beta-usage", {
      method: "POST", body: JSON.stringify({ type: "message_sent" }),
    }));
    expect(response.status).toBe(202);
    expect(supabase.rpc).toHaveBeenCalledWith("record_product_funnel_event", expect.objectContaining({
      p_event_type: "message_sent", p_project_id: null, p_metadata: {},
    }));
  });

  it("records beta_signed_in idempotently without a project", async () => {
    const supabase = client();
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/beta-usage", {
      method: "POST", body: JSON.stringify({ type: "beta_signed_in" }),
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ recorded: true });
    expect(supabase.rpc).toHaveBeenCalledWith("record_product_funnel_event", expect.objectContaining({
      p_event_type: "beta_signed_in", p_project_id: null,
    }));
  });

  it("reports persistence failure so the client can retry tracking", async () => {
    const supabase = client({ code: "42501", message: "offline" });
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/beta-usage", {
      method: "POST", body: JSON.stringify({ type: "message_sent", projectId: "project-a" }),
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ recorded: false });
  });
});
