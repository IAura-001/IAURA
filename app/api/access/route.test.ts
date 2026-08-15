import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  ACCESS_ATTEMPT_MAX_FAILURES,
  resetAccessAttemptLimitsForTests,
} from "@/core/auth/accessAttempts";

const inviteMocks = vi.hoisted(() => ({
  recognize: vi.fn(),
  getUser: vi.fn(),
  getMembership: vi.fn(),
  claim: vi.fn(),
}));

vi.mock("@/core/auth/membership", () => ({
  recognizeBetaInvite: inviteMocks.recognize,
  getCurrentBetaMembership: inviteMocks.getMembership,
  claimCurrentUserBetaInvite: inviteMocks.claim,
}));
vi.mock("@/core/auth/session", () => ({ getAuthenticatedUser: inviteMocks.getUser }));
import { POST } from "./route";

const secret = "aura-prime-private-key";

function accessRequest(
  accessKey: string,
  address = "203.0.113.10",
  userAgent = "vaeora-route-test",
): Request {
  return new Request("https://vaeora.test/api/access", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
      "X-Forwarded-For": address,
    },
    body: JSON.stringify({ accessKey }),
  });
}

describe("POST /api/access", () => {
  beforeEach(() => {
    vi.stubEnv("IAURA_ACCESS_KEY", secret);
    vi.stubEnv("IAURA_CLAIM_CONTEXT_SECRET", "test-claim-context-secret-with-32-characters");
    inviteMocks.recognize.mockReset().mockResolvedValue(false);
    inviteMocks.getUser.mockReset().mockResolvedValue(null);
    inviteMocks.getMembership.mockReset().mockResolvedValue(null);
    inviteMocks.claim.mockReset().mockResolvedValue({ role: "member", status: "active" });
    resetAccessAttemptLimitsForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAccessAttemptLimitsForTests();
  });

  it("fails closed when private access is not configured", async () => {
    vi.stubEnv("IAURA_ACCESS_KEY", "");

    const response = await POST(accessRequest(secret));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("recognizes an invite without consuming it before Auth", async () => {
    inviteMocks.recognize.mockResolvedValue(true);
    const response = await POST(accessRequest("a".repeat(32)));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ authenticated: true, next: "/signup" });
    expect(response.headers.get("set-cookie")).toContain("iaura_beta_claim=");
    expect(inviteMocks.claim).not.toHaveBeenCalled();
  });

  it("claims immediately for a returning authenticated user", async () => {
    inviteMocks.recognize.mockResolvedValue(true);
    inviteMocks.getUser.mockResolvedValue({ id: "user-a" });
    const response = await POST(accessRequest("a".repeat(32)));
    await expect(response.json()).resolves.toMatchObject({ next: "/iaura" });
    expect(inviteMocks.claim).toHaveBeenCalledWith("a".repeat(32));
  });

  it("does not consume another invite for an existing active member", async () => {
    inviteMocks.recognize.mockResolvedValue(true);
    inviteMocks.getUser.mockResolvedValue({ id: "user-a" });
    inviteMocks.getMembership.mockResolvedValue({ status: "active", role: "member" });
    await POST(accessRequest("a".repeat(32)));
    expect(inviteMocks.claim).not.toHaveBeenCalled();
  });

  it("throttles repeated invalid access attempts", async () => {
    for (let index = 0; index < ACCESS_ATTEMPT_MAX_FAILURES; index += 1) {
      const response = await POST(accessRequest("incorrect-key"));
      expect(response.status).toBe(401);
    }

    const blocked = await POST(accessRequest("incorrect-key"));

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(blocked.headers.get("cache-control")).toBe("no-store");
  });

  it("clears the client failure window after valid access", async () => {
    for (
      let index = 0;
      index < ACCESS_ATTEMPT_MAX_FAILURES - 1;
      index += 1
    ) {
      expect((await POST(accessRequest("incorrect-key"))).status).toBe(401);
    }

    const authenticated = await POST(accessRequest(secret));
    expect(authenticated.status).toBe(200);
    expect(authenticated.headers.get("set-cookie")).toContain(
      "iaura_beta_access=",
    );

    for (let index = 0; index < ACCESS_ATTEMPT_MAX_FAILURES; index += 1) {
      expect((await POST(accessRequest("incorrect-key"))).status).toBe(401);
    }

    expect((await POST(accessRequest("incorrect-key"))).status).toBe(429);
  });

  it("does not let user-agent rotation evade the client limit", async () => {
    for (let index = 0; index < ACCESS_ATTEMPT_MAX_FAILURES; index += 1) {
      const response = await POST(
        accessRequest(
          "incorrect-key",
          "203.0.113.20",
          `rotating-agent-${index}`,
        ),
      );
      expect(response.status).toBe(401);
    }

    const blocked = await POST(
      accessRequest(
        "incorrect-key",
        "203.0.113.20",
        "one-more-agent",
      ),
    );

    expect(blocked.status).toBe(429);
  });

  it("allows a valid key to recover a rate-limited client", async () => {
    const address = "203.0.113.25";

    for (let index = 0; index < ACCESS_ATTEMPT_MAX_FAILURES; index += 1) {
      expect(
        (await POST(accessRequest("incorrect-key", address))).status,
      ).toBe(401);
    }

    expect(
      (await POST(accessRequest("incorrect-key", address))).status,
    ).toBe(429);

    const authenticated = await POST(accessRequest(secret, address));

    expect(authenticated.status).toBe(200);
    expect(authenticated.headers.get("set-cookie")).toContain(
      "iaura_beta_access=",
    );

    expect(
      (await POST(accessRequest("incorrect-key", address))).status,
    ).toBe(401);
  });

  it("never lets failed clients lock out an unrelated valid client", async () => {
    for (let client = 0; client < 8; client += 1) {
      const address = `203.0.113.${30 + client}`;

      for (
        let attempt = 0;
        attempt < ACCESS_ATTEMPT_MAX_FAILURES;
        attempt += 1
      ) {
        expect(
          (await POST(accessRequest("incorrect-key", address))).status,
        ).toBe(401);
      }

      expect(
        (await POST(accessRequest("incorrect-key", address))).status,
      ).toBe(429);
    }

    const authenticated = await POST(
      accessRequest(secret, "198.51.100.42"),
    );

    expect(authenticated.status).toBe(200);
    expect(authenticated.headers.get("set-cookie")).toContain(
      "iaura_beta_access=",
    );
  });
});
