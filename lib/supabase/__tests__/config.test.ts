import { afterEach, describe, expect, it, vi } from "vitest";

import { getPublicSupabaseConfig } from "../config";

describe("Supabase public configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not fail until Supabase configuration is requested", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(() => getPublicSupabaseConfig()).toThrow(
      "Supabase is not configured",
    );
  });

  it("uses only the browser-visible URL and publishable key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "must-not-be-used");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "must-not-be-used");

    expect(getPublicSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "public-key",
    });
  });
});
