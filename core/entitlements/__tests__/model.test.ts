import { describe, expect, it } from "vitest";
import { DEFAULT_ENTITLEMENT_LIMITS, defaultEntitlementProfile, decideCapability,
  decideImageGeneration, decideProjectCreation, decideStorageUpload, imageCreditUnits,
  resolveEntitlementProfile, wouldExceedStorageLimit } from "../model";
import type { EntitlementCapability, EntitlementProfile, EntitlementUsage } from "../types";

const usage = (values: Partial<EntitlementUsage> = {}): EntitlementUsage => ({
  activeProjects: 0, aiOperationsThisMonth: 0, imageCreditsThisMonth: 0,
  storageBytes: 0, assetCount: 0, concurrentAiOperations: 0, ...values,
});

describe("plan-neutral entitlement model", () => {
  it("provides a deterministic beta fallback that preserves onboarding", () => {
    const profile = resolveEntitlementProfile(null);
    expect(profile.profileId).toBe("beta_default_v1");
    expect(decideProjectCreation(profile, usage()).allowed).toBe(true);
    expect(decideImageGeneration(profile, usage(), "draft").allowed).toBe(true);
  });

  it("resolves an active explicit internal profile without feature-code plan checks", () => {
    const profile: EntitlementProfile = { ...defaultEntitlementProfile(), profileId: "internal_unrestricted_v1",
      startsAt: "2026-01-01T00:00:00Z", endsAt: null,
      limits: { ...DEFAULT_ENTITLEMENT_LIMITS, maxActiveProjects: 10_000 } };
    expect(resolveEntitlementProfile(profile, defaultEntitlementProfile(), new Date("2026-08-30T00:00:00Z")).profileId)
      .toBe("internal_unrestricted_v1");
  });

  it("falls back before assignment start and after expiry", () => {
    const future = { ...defaultEntitlementProfile(), profileId: "future", startsAt: "2026-09-01T00:00:00Z" };
    const expired = { ...future, startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-08-01T00:00:00Z" };
    const now = new Date("2026-08-30T00:00:00Z");
    expect(resolveEntitlementProfile(future, defaultEntitlementProfile(), now).profileId).toBe("beta_default_v1");
    expect(resolveEntitlementProfile(expired, defaultEntitlementProfile(), now).profileId).toBe("beta_default_v1");
  });

  it("allows a project below the active limit and denies at the boundary", () => {
    const profile = defaultEntitlementProfile(); profile.limits.maxActiveProjects = 2;
    expect(decideProjectCreation(profile, usage({ activeProjects: 1 })).reason).toBe("ALLOWED");
    expect(decideProjectCreation(profile, usage({ activeProjects: 2 }))).toMatchObject({ allowed: false,
      reason: "PROJECT_LIMIT_REACHED", remaining: 0 });
  });

  it("keeps capability denials machine-readable", () => {
    const profile = { ...defaultEntitlementProfile(), capabilities: new Set<EntitlementCapability>() };
    expect(decideCapability(profile, "ai.speech").reason).toBe("CAPABILITY_NOT_ALLOWED");
  });

  it("weights image tiers and distinguishes tier denial from exhausted allowance", () => {
    expect([imageCreditUnits("draft"), imageCreditUnits("premium"), imageCreditUnits("ultra")]).toEqual([1, 2, 6]);
    const profile = defaultEntitlementProfile(); profile.limits.imageCreditsPerMonth = 6;
    expect(decideImageGeneration(profile, usage({ imageCreditsThisMonth: 4 }), "premium").allowed).toBe(true);
    expect(decideImageGeneration(profile, usage({ imageCreditsThisMonth: 1 }), "ultra").reason)
      .toBe("IMAGE_ALLOWANCE_EXHAUSTED");
    profile.capabilities = new Set([...profile.capabilities].filter((item) => item !== "image.tier.ultra"));
    expect(decideImageGeneration(profile, usage(), "ultra").reason).toBe("IMAGE_TIER_NOT_ALLOWED");
  });

  it("handles storage below, exactly at, and above its boundary without loading binaries", () => {
    expect(wouldExceedStorageLimit(80, 19, 100)).toBe(false);
    expect(wouldExceedStorageLimit(80, 20, 100)).toBe(false);
    expect(wouldExceedStorageLimit(80, 21, 100)).toBe(true);
    const profile = defaultEntitlementProfile(); profile.limits.storageBytes = 100;
    expect(decideStorageUpload(profile, usage({ storageBytes: 80 }), 20).allowed).toBe(true);
    expect(decideStorageUpload(profile, usage({ storageBytes: 80 }), 21).reason).toBe("STORAGE_LIMIT_EXCEEDED");
  });

  it("denies a new asset at the asset-count limit independently of bytes", () => {
    const profile = defaultEntitlementProfile(); profile.limits.assetCount = 2;
    expect(decideStorageUpload(profile, usage({ assetCount: 2 }), 1).reason).toBe("ASSET_LIMIT_REACHED");
  });

  it("fails closed for invalid or overflowing storage arithmetic", () => {
    expect(wouldExceedStorageLimit(Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(wouldExceedStorageLimit(-1, 1, 10)).toBe(true);
  });
});
