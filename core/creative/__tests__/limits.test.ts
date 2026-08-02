import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { CreativeRequestError } from "../errors";
import {
  acquireCreativeGenerationLease,
  assertCreativeGenerationDeploymentReady,
  CREATIVE_GENERATION_POLICIES,
  CREATIVE_PRODUCTION_GUARD_VALUE,
  createCreativeGenerationScope,
  createCreativeRequestFingerprint,
  creativeImageCostUnits,
  isCreativeGenerationDeploymentReady,
  resetCreativeGenerationLimitsForTests,
} from "../limits";

describe("creative generation limits", () => {
  beforeEach(() => {
    resetCreativeGenerationLimitsForTests();
  });

  it("limits concurrent image generations and releases idempotently", async () => {
    const lease = await acquireCreativeGenerationLease("image", 1, {
      now: 1_000,
    });

    await expect(
      acquireCreativeGenerationLease("image", 1, { now: 1_000 }),
    ).rejects.toBeInstanceOf(CreativeRequestError);

    await lease.release();
    await lease.release();

    const nextLease = await acquireCreativeGenerationLease("image", 1, {
      now: 1_000,
    });
    await nextLease.release();
  });

  it("weights ultra images and resets after the usage window", async () => {
    const now = 10_000;
    const ultraUnits = creativeImageCostUnits("ultra");
    const allowedUltraRenders = Math.floor(
      CREATIVE_GENERATION_POLICIES.image.maxUnits / ultraUnits,
    );

    for (let index = 0; index < allowedUltraRenders; index += 1) {
      const lease = await acquireCreativeGenerationLease(
        "image",
        ultraUnits,
        { now },
      );
      await lease.release();
    }

    await expect(
      acquireCreativeGenerationLease("image", ultraUnits, { now }),
    ).rejects.toMatchObject({
      status: 429,
      code: "VAEORA_RATE_LIMITED",
      retryAfter: 600,
    });

    const afterWindow = now + CREATIVE_GENERATION_POLICIES.image.windowMs;
    const nextLease = await acquireCreativeGenerationLease(
      "image",
      ultraUnits,
      { now: afterWindow },
    );
    await nextLease.release();
  });

  it("budgets for exploration followed by one coordinated premium Brand Kit", async () => {
    const now = 11_000;
    const scope = "brand-kit-session";

    for (let index = 0; index < 6; index += 1) {
      const preview = await acquireCreativeGenerationLease(
        "image",
        creativeImageCostUnits("draft"),
        { now, scope },
      );
      await preview.release();
    }

    for (let index = 0; index < 6; index += 1) {
      const kitAsset = await acquireCreativeGenerationLease(
        "image",
        creativeImageCostUnits("premium"),
        { now, scope },
      );
      await kitAsset.release();
    }
  });

  it("enforces the independent copy concurrency ceiling", async () => {
    const first = await acquireCreativeGenerationLease("copy", 1, {
      now: 5_000,
    });
    const second = await acquireCreativeGenerationLease("copy", 1, {
      now: 5_000,
    });

    await expect(
      acquireCreativeGenerationLease("copy", 1, { now: 5_000 }),
    ).rejects.toBeInstanceOf(CreativeRequestError);

    await first.release();
    await second.release();
  });

  it("limits one authenticated scope before it consumes the global budget", async () => {
    const now = 8_000;
    const scopedUltraRenders = Math.floor(
      CREATIVE_GENERATION_POLICIES.image.maxScopeUnits / 6,
    );

    for (let index = 0; index < scopedUltraRenders; index += 1) {
      const lease = await acquireCreativeGenerationLease("image", 6, {
        now,
        scope: "session-a",
      });
      await lease.release();
    }

    await expect(
      acquireCreativeGenerationLease("image", 1, {
        now,
        scope: "session-a",
      }),
    ).rejects.toMatchObject({
      status: 429,
      code: "VAEORA_RATE_LIMITED",
    });

    const otherScope = await acquireCreativeGenerationLease("image", 1, {
      now,
      scope: "session-b",
    });
    await otherScope.release();
  });

  it("deduplicates a recently accepted paid request without charging it twice", async () => {
    const options = {
      now: 12_000,
      scope: "session-a",
      fingerprint: "same-request",
    };
    const first = await acquireCreativeGenerationLease("copy", 1, options);
    await first.release();

    await expect(
      acquireCreativeGenerationLease("copy", 1, {
        ...options,
        now: 13_000,
      }),
    ).rejects.toMatchObject({
      status: 429,
      code: "VAEORA_RATE_LIMITED",
      retryAfter: 4,
    });

    const afterDedupe = await acquireCreativeGenerationLease("copy", 1, {
      ...options,
      now: 17_000,
    });
    await afterDedupe.release();
  });

  it("hashes authenticated sessions and request payloads without exposing them", () => {
    const request = new Request("https://vaeora.test/api/creative/image", {
      headers: {
        Cookie: "iaura_beta_access=private-token; theme=dark",
      },
    });
    const scope = createCreativeGenerationScope(request);
    const fingerprint = createCreativeRequestFingerprint(
      "image",
      scope,
      { prompt: "private prompt" },
    );

    expect(scope).not.toContain("private-token");
    expect(fingerprint).not.toContain("private prompt");
    expect(scope).toHaveLength(43);
    expect(fingerprint).toHaveLength(43);
  });

  it("keeps local development available and fails closed in production", () => {
    expect(
      isCreativeGenerationDeploymentReady({ NODE_ENV: "development" }),
    ).toBe(true);
    expect(
      isCreativeGenerationDeploymentReady({ NODE_ENV: "test" }),
    ).toBe(true);
    expect(
      isCreativeGenerationDeploymentReady({ NODE_ENV: "production" }),
    ).toBe(false);
    expect(() =>
      assertCreativeGenerationDeploymentReady({ NODE_ENV: "production" }),
    ).toThrowError(CreativeRequestError);
    expect(
      isCreativeGenerationDeploymentReady({
        NODE_ENV: "production",
        VAEORA_CREATIVE_PRODUCTION_GUARD:
          CREATIVE_PRODUCTION_GUARD_VALUE,
      }),
    ).toBe(true);
  });
});
