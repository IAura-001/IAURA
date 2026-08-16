import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock("@/core/auth/session", async () => {
  const { NextResponse } = await import("next/server");
  return { getAuthenticatedUser: mocks.getUser, authenticationRequiredResponse: () => NextResponse.json({ error: "required" }, { status: 401 }) };
});
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ from: () => ({ update: mocks.update }) })) }));

import { PATCH } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("PATCH /api/profile", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ id: "user-a" });
    mocks.eq.mockReset().mockImplementation((_column: string, id: string) => ({ select: () => ({ maybeSingle: async () => ({ data: { id, first_name: "Carlos", last_name: "Rivera", display_name: "Carl", onboarding_completed: true }, error: null }) }) }));
    mocks.update.mockReset().mockImplementation(() => ({ eq: mocks.eq }));
  });

  it("persists explicit identity only for the verified user", async () => {
    const response = await PATCH(request({ firstName: "Carlos", lastName: "Rivera", displayName: "Carl", userId: "user-b" }));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ first_name: "Carlos", last_name: "Rivera", display_name: "Carl", onboarding_completed: true });
    expect(mocks.eq).toHaveBeenCalledWith("id", "user-a");
  });

  it("rejects missing first name and requires authentication", async () => {
    expect((await PATCH(request({ firstName: "", displayName: "Someone" }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue(null);
    expect((await PATCH(request({ firstName: "Carlos" }))).status).toBe(401);
  });
});
