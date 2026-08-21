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

import { PUT } from "./route";

const snapshot = {
  schemaVersion: 3,
  revision: 6,
  updatedAt: "2026-08-20T12:00:00.000Z",
  writerId: "writer-a",
  migrationCompletedAt: "2026-08-20T10:00:00.000Z",
  activeConversationId: "conversation-a",
  conversations: [],
};

function staleClient() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const query = {
    select: vi.fn(), update: vi.fn(), insert: vi.fn(), eq: vi.fn(), maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { from: vi.fn(() => query) };
}

describe("PUT /api/conversations", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ id: "user-a" });
    mocks.createClient.mockReset();
  });

  it("rejects a stale full-snapshot write instead of overwriting newer remote state", async () => {
    mocks.createClient.mockResolvedValue(staleClient());
    const response = await PUT(new Request("http://localhost/api/conversations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot, expectedRevision: 5 }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "IAURA_STATE_STALE_WRITE" });
  });

  it("rejects snapshots without an explicit base revision", async () => {
    const response = await PUT(new Request("http://localhost/api/conversations", {
      method: "PUT",
      body: JSON.stringify({ snapshot }),
    }));
    expect(response.status).toBe(400);
  });
});
