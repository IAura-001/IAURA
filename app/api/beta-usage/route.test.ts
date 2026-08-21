import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/core/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/core/auth/session")>("@/core/auth/session");
  return { ...actual, getAuthenticatedUser: mocks.getUser };
});
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createClient }));

import { POST } from "./route";

function client(insertError: unknown = null, projectOwner = true) {
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: projectOwner ? { id: "project-a" } : null,
    error: null,
  });
  const projectQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle };
  projectQuery.select.mockReturnValue(projectQuery);
  projectQuery.eq.mockReturnValue(projectQuery);
  const from = vi.fn((table: string) => table === "projects" ? projectQuery : { insert });
  return { from, insert };
}

describe("POST /api/beta-usage", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ id: "user-a" });
    mocks.createClient.mockReset();
  });

  it("binds the event to the authenticated user and stores no message content", async () => {
    const supabase = client();
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/beta-usage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "message_sent", projectId: "project-a", userId: "user-b", message: "private text" }),
    }));

    expect(response.status).toBe(202);
    expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-a", event_type: "message_sent", project_id: "project-a", metadata: {},
    }));
    expect(JSON.stringify(supabase.insert.mock.calls[0][0])).not.toContain("private text");
  });

  it("rejects a project that is not owned by the authenticated user", async () => {
    const supabase = client(null, false);
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/beta-usage", {
      method: "POST", body: JSON.stringify({ type: "project_opened", projectId: "project-b" }),
    }));
    expect(response.status).toBe(400);
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("records general IAURA usage without inventing a project scope", async () => {
    const supabase = client();
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/beta-usage", {
      method: "POST", body: JSON.stringify({ type: "message_sent" }),
    }));
    expect(response.status).toBe(202);
    expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-a", project_id: null, metadata: {},
    }));
  });

  it("records beta_signed_in without a project and treats its daily duplicate as recorded", async () => {
    const supabase = client({ code: "23505", message: "duplicate" });
    mocks.createClient.mockResolvedValue(supabase);
    const response = await POST(new Request("http://localhost/api/beta-usage", {
      method: "POST", body: JSON.stringify({ type: "beta_signed_in" }),
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ recorded: true, deduplicated: true });
    expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-a", event_type: "beta_signed_in", project_id: null,
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
