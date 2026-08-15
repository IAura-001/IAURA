import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLAIM_CONTEXT_COOKIE_NAME, createClaimContext, readClaimContext } from "../claimContext";

describe("sealed Beta claim context", () => {
  beforeEach(() => vi.stubEnv("IAURA_CLAIM_CONTEXT_SECRET", "test-claim-context-secret-with-32-characters"));

  it("round-trips only through an HttpOnly-style request cookie", () => {
    const value = createClaimContext("a".repeat(32), 1_000_000);
    const request = new Request("https://vaeora.test/login", { headers: { Cookie: `${CLAIM_CONTEXT_COOKIE_NAME}=${value}` } });
    expect(readClaimContext(request, 1_001_000)).toBe("a".repeat(32));
    expect(value).not.toContain("a".repeat(32));
  });

  it.each(["random", "part.one.two", ""])("rejects forged or altered context: %s", (value) => {
    const request = new Request("https://vaeora.test/login", { headers: { Cookie: `${CLAIM_CONTEXT_COOKIE_NAME}=${value}` } });
    expect(readClaimContext(request)).toBeNull();
  });

  it("rejects an expired context", () => {
    const value = createClaimContext("a".repeat(32), 1_000_000);
    const request = new Request("https://vaeora.test/login", { headers: { Cookie: `${CLAIM_CONTEXT_COOKIE_NAME}=${value}` } });
    expect(readClaimContext(request, 1_000_000 + 11 * 60_000)).toBeNull();
  });
});
