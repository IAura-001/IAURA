import {
  createAccessToken,
  isRequestAuthorized,
  matchesAccessKey,
  verifyAccessToken,
} from "@/core/auth/access";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

describe("IAURA private beta access", () => {
  const secret = "aura-prime-private-key";
  const now = 1_800_000_000_000;

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a valid signed session", () => {
    const token = createAccessToken(
      secret,
      now
    );

    expect(
      verifyAccessToken(token, secret, now)
    ).toBe(true);
  });

  it("rejects tampered and expired sessions", () => {
    const token = createAccessToken(
      secret,
      now
    );

    expect(
      verifyAccessToken(
        `${token}tampered`,
        secret,
        now
      )
    ).toBe(false);
    expect(
      verifyAccessToken(
        token,
        secret,
        now + 8 * 24 * 60 * 60 * 1000
      )
    ).toBe(false);
    expect(
      verifyAccessToken(
        `${token}.unexpected`,
        secret,
        now
      )
    ).toBe(false);
  });

  it("compares access keys safely", () => {
    expect(
      matchesAccessKey(secret, secret)
    ).toBe(true);
    expect(
      matchesAccessKey("wrong-key", secret)
    ).toBe(false);
  });

  it("treats a malformed encoded cookie as unauthorized", () => {
    vi.stubEnv("IAURA_ACCESS_KEY", secret);
    const request = new Request("https://vaeora.test/iaura", {
      headers: {
        Cookie: "iaura_beta_access=%E0%A4%A",
      },
    });

    expect(() => isRequestAuthorized(request)).not.toThrow();
    expect(isRequestAuthorized(request)).toBe(false);
  });
});
