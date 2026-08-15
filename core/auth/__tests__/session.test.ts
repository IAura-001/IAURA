import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));

import { getAuthenticatedUser, validateCredentials } from "../session";

describe("authoritative server session", () => {
  beforeEach(() => mocks.getUser.mockReset());

  it("returns only a user verified by auth.getUser", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
    await expect(getAuthenticatedUser()).resolves.toMatchObject({ id: "user-a" });
  });

  it("returns null for a missing or invalid session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    await expect(getAuthenticatedUser()).resolves.toBeNull();
  });

  it("normalizes email and rejects weak credentials", () => {
    expect(validateCredentials(" USER@Example.COM ", "long-password")).toEqual({
      email: "user@example.com", password: "long-password",
    });
    expect(validateCredentials("invalid", "short")).toBeNull();
  });
});
