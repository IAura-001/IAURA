import type { CreativeImageTier } from "@/core/creative/types";
import type { EntitlementCapability, EntitlementDecision, EntitlementLimits,
  EntitlementProfile, EntitlementUsage } from "./types";

export const DEFAULT_ENTITLEMENT_PROFILE_ID = "beta_default_v1";
export const INTERNAL_ENTITLEMENT_PROFILE_ID = "internal_unrestricted_v1";

export const DEFAULT_ENTITLEMENT_LIMITS: EntitlementLimits = {
  maxActiveProjects: 100,
  aiOperationsPerMonth: 10_000,
  imageCreditsPerMonth: 1_000,
  storageBytes: 5 * 1024 * 1024 * 1024,
  assetCount: 5_000,
  concurrentAiOperations: 3,
};

const ALL_CAPABILITIES = new Set<EntitlementCapability>([
  "project.create", "ai.chat", "ai.creative_copy", "ai.creative_image",
  "ai.transcription", "ai.speech", "image.tier.draft", "image.tier.premium",
  "image.tier.ultra", "asset.upload",
]);

export function defaultEntitlementProfile(): EntitlementProfile {
  return { profileId: DEFAULT_ENTITLEMENT_PROFILE_ID, capabilities: ALL_CAPABILITIES,
    limits: { ...DEFAULT_ENTITLEMENT_LIMITS }, startsAt: null, endsAt: null,
    fallbackProfileId: DEFAULT_ENTITLEMENT_PROFILE_ID };
}
export function resolveEntitlementProfile(assigned: EntitlementProfile | null,
  fallback: EntitlementProfile = defaultEntitlementProfile(), now = new Date()): EntitlementProfile {
  if (!assigned) return fallback;
  const started = !assigned.startsAt || Date.parse(assigned.startsAt) <= now.getTime();
  const active = !assigned.endsAt || Date.parse(assigned.endsAt) > now.getTime();
  return started && active ? assigned : fallback;
}

export function wouldExceedStorageLimit(currentBytes: number, incomingBytes: number, limit: number): boolean {
  if (![currentBytes, incomingBytes, limit].every(Number.isSafeInteger) || currentBytes < 0 || incomingBytes < 0 || limit < 0) return true;
  return incomingBytes > limit - currentBytes;
}

function numericDecision(capability: EntitlementCapability, used: number, incoming: number,
  limit: number, reason: EntitlementDecision["reason"], resetAt?: string): EntitlementDecision {
  const allowed = incoming <= Math.max(0, limit - used);
  return { allowed, capability, reason: allowed ? "ALLOWED" : reason, limit, used,
    remaining: Math.max(0, limit - used), ...(resetAt ? { resetAt } : {}) };
}

export function decideCapability(profile: EntitlementProfile, capability: EntitlementCapability): EntitlementDecision {
  const allowed = profile.capabilities.has(capability);
  return { allowed, capability, reason: allowed ? "ALLOWED" : "CAPABILITY_NOT_ALLOWED",
    limit: null, used: null, remaining: null };
}

export function decideProjectCreation(profile: EntitlementProfile, usage: EntitlementUsage): EntitlementDecision {
  const base = decideCapability(profile, "project.create");
  return base.allowed ? numericDecision("project.create", usage.activeProjects, 1,
    profile.limits.maxActiveProjects, "PROJECT_LIMIT_REACHED") : base;
}

export function imageCreditUnits(tier: CreativeImageTier): number {
  return tier === "ultra" ? 6 : tier === "premium" ? 2 : 1;
}

export function decideImageGeneration(profile: EntitlementProfile, usage: EntitlementUsage,
  tier: CreativeImageTier, resetAt?: string): EntitlementDecision {
  const tierCapability = `image.tier.${tier}` as EntitlementCapability;
  if (!profile.capabilities.has(tierCapability)) return { allowed: false, capability: tierCapability,
    reason: "IMAGE_TIER_NOT_ALLOWED", limit: null, used: usage.imageCreditsThisMonth, remaining: null };
  return numericDecision("ai.creative_image", usage.imageCreditsThisMonth, imageCreditUnits(tier),
    profile.limits.imageCreditsPerMonth, "IMAGE_ALLOWANCE_EXHAUSTED", resetAt);
}

export function decideStorageUpload(profile: EntitlementProfile, usage: EntitlementUsage,
  incomingBytes: number): EntitlementDecision {
  const base = decideCapability(profile, "asset.upload");
  if (!base.allowed) return base;
  if (usage.assetCount >= profile.limits.assetCount) return { allowed: false, capability: "asset.upload",
    reason: "ASSET_LIMIT_REACHED", limit: profile.limits.assetCount, used: usage.assetCount, remaining: 0 };
  return numericDecision("asset.upload", usage.storageBytes, incomingBytes,
    profile.limits.storageBytes, "STORAGE_LIMIT_EXCEEDED");
}
