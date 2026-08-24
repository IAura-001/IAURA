import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createClient.mockImplementation(
    async () => ({ auth: { getUser: mocks.getUser } }),
  ),
}));

import { getAuthenticatedUser, validateCredentials } from "../session";

describe("authoritative server session", () => {
  beforeEach(() => { mocks.getUser.mockReset(); mocks.createClient.mockClear(); });

  it("returns only a user verified by auth.getUser", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
    await expect(getAuthenticatedUser()).resolves.toMatchObject({ id: "user-a" });
  });

  it("returns null for a missing or invalid session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    await expect(getAuthenticatedUser()).resolves.toBeNull();
  });

  it("binds identity resolution to the incoming request", async () => {
    const request = new Request("https://vaeora.test/api/chat", {
      headers: { cookie: "sb-project-auth-token=request-session" },
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-b" } }, error: null });
    await expect(getAuthenticatedUser(request)).resolves.toMatchObject({ id: "user-b" });
    expect(mocks.createClient).toHaveBeenCalledWith(request);
  });

  it("normalizes email and rejects weak credentials", () => {
    expect(validateCredentials(" USER@Example.COM ", "long-password")).toEqual({
      email: "user@example.com", password: "long-password",
    });
    expect(validateCredentials("invalid", "short")).toBeNull();
  });
});
