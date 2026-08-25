import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { createAdminSupabaseClient } from "../admin";

describe("Supabase admin client", () => {
  beforeEach(() => {
    mocks.createClient.mockReset().mockReturnValue({});
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("constructs the server-only client with an sb_secret key", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_example");

    createAdminSupabaseClient();

    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_secret_example",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it("rejects a missing server secret", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => createAdminSupabaseClient()).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects legacy JWT-shaped service-role API keys", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJlegacy-api-key");

    expect(() => createAdminSupabaseClient()).toThrow("sb_secret_ format");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
