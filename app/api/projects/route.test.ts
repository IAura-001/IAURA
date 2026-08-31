import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), createClient: vi.fn() }));
vi.mock("@/core/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/core/auth/session")>("@/core/auth/session");
  return { ...actual, getAuthenticatedUser: mocks.getUser };
});
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createClient }));

import { POST } from "./route";

const project = {
  id: "project-a", name: "Launch", description: "", goal: "Launch",
  createdAt: "2026-08-29T00:00:00Z", updatedAt: "2026-08-29T00:00:00Z",
  status: "planning", studios: {
    branding: false, website: false, app: false, marketing: false, documents: false,
  },
};

function client(createError: unknown = null, eventError: unknown = null, created = true) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn((name: string) => Promise.resolve(name === "create_project_with_entitlement"
    ? { data: created, error: createError } : { data: !eventError, error: eventError }));
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "project-a" }, error: null });
  const query = { insert, select: vi.fn(), eq: vi.fn(), maybeSingle };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  return { from: vi.fn(() => query), insert, rpc };
}

describe("POST /api/projects product instrumentation", () => {
  beforeEach(() => mocks.getUser.mockReset().mockResolvedValue({ id: "user-a" }));

  it("records project_created exactly at the successful durable insert boundary", async () => {
    const supabase = client();
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/projects", {
      method: "POST", body: JSON.stringify({ project }),
      headers: { "X-VAEORA-Session-Id": "123e4567-e89b-42d3-a456-426614174000" },
    }));
    expect(response.status).toBe(201);
    expect(supabase.rpc).toHaveBeenCalledWith("record_product_funnel_event", expect.objectContaining({
      p_event_type: "project_created", p_project_id: "project-a",
      p_event_key: "project_created:project-a",
    }));
  });

  it("does not emit project_created when project persistence fails", async () => {
    const supabase = client({ code: "XX000" });
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/projects", {
      method: "POST", body: JSON.stringify({ project }),
    }));
    expect(response.status).toBe(503);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("does not fail project creation when analytics is unavailable", async () => {
    const supabase = client(null, { code: "XX000" });
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/projects", {
      method: "POST", body: JSON.stringify({ project }),
    }));
    expect(response.status).toBe(201);
  });

  it("treats an owned retry as success and relies on the semantic event key", async () => {
    const supabase = client(null, null, false);
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/projects", {
      method: "POST", body: JSON.stringify({ project }),
    }));
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("record_product_funnel_event", expect.objectContaining({
      p_event_key: "project_created:project-a",
    }));
  });

  it("returns a structured neutral denial and never emits creation analytics", async () => {
    const supabase = client({ code: "P0002", message: "PROJECT_LIMIT_REACHED" });
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/projects", {
      method: "POST", body: JSON.stringify({ project }),
    }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "PROJECT_LIMIT_REACHED" });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});
