import {
  createAccessToken,
  matchesAccessKey,
  verifyAccessToken,
} from "@/core/auth/access";

describe("IAURA private beta access", () => {
  const secret = "aura-prime-private-key";
  const now = 1_800_000_000_000;

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
  });

  it("compares access keys safely", () => {
    expect(
      matchesAccessKey(secret, secret)
    ).toBe(true);
    expect(
      matchesAccessKey("wrong-key", secret)
    ).toBe(false);
  });
});
