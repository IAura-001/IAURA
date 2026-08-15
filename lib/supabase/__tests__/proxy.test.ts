import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getUser: vi.fn() }));

vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("../config", () => ({
  getPublicSupabaseConfig: () => ({ url: "http://127.0.0.1:54321", publishableKey: "local-public-key" }),
}));

import { refreshSupabaseSession } from "../proxy";

describe("request-bound Supabase refresh", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
    mocks.getUser.mockReset();
    mocks.createServerClient.mockImplementation((_url, _key, options) => ({
      auth: { getUser: async () => {
        options.cookies.setAll([{ name: "sb-refresh", value: "rotated", options: { httpOnly: true } }]);
        return mocks.getUser();
      } },
    }));
  });

  it("verifies the user and propagates refreshed cookies", async () => {
    mocks.getUser.mockReturnValue({ data: { user: { id: "user-a" } }, error: null });
    const result = await refreshSupabaseSession(new NextRequest("https://vaeora.test/iaura"));
    expect(result.user).toMatchObject({ id: "user-a" });
    expect(result.response.cookies.get("sb-refresh")?.value).toBe("rotated");
  });

  it("treats an invalid session as unauthenticated while clearing cookies", async () => {
    mocks.getUser.mockReturnValue({ data: { user: null }, error: new Error("invalid") });
    const result = await refreshSupabaseSession(new NextRequest("https://vaeora.test/iaura"));
    expect(result.user).toBeNull();
    expect(result.response.cookies.get("sb-refresh")?.value).toBe("rotated");
  });
});
