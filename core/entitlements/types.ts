export const ENTITLEMENT_CAPABILITIES = [
  "project.create", "ai.chat", "ai.creative_copy", "ai.creative_image",
  "ai.transcription", "ai.speech", "image.tier.draft", "image.tier.premium",
  "image.tier.ultra", "asset.upload",
] as const;

export type EntitlementCapability = typeof ENTITLEMENT_CAPABILITIES[number];
export type EntitlementPeriod = "rolling_24h" | "calendar_month" | "lifetime";
export type EntitlementReason =
  | "ALLOWED" | "CAPABILITY_NOT_ALLOWED" | "PROJECT_LIMIT_REACHED"
  | "AI_ALLOWANCE_EXHAUSTED" | "IMAGE_ALLOWANCE_EXHAUSTED"
  | "IMAGE_TIER_NOT_ALLOWED" | "STORAGE_LIMIT_EXCEEDED"
  | "ASSET_LIMIT_REACHED" | "CONCURRENCY_LIMIT_REACHED"
  | "SAFETY_LIMIT_REACHED";

export interface EntitlementLimits {
  maxActiveProjects: number;
  aiOperationsPerMonth: number;
  imageCreditsPerMonth: number;
  storageBytes: number;
  assetCount: number;
  concurrentAiOperations: number;
}
export interface EntitlementProfile {
  profileId: string;
  capabilities: ReadonlySet<EntitlementCapability>;
  limits: EntitlementLimits;
  startsAt: string | null;
  endsAt: string | null;
  fallbackProfileId: string;
}

export interface EntitlementUsage {
  activeProjects: number;
  aiOperationsThisMonth: number;
  imageCreditsThisMonth: number;
  storageBytes: number;
  assetCount: number;
  concurrentAiOperations: number;
}

export interface EntitlementDecision {
  allowed: boolean;
  capability: EntitlementCapability;
  reason: EntitlementReason;
  limit: number | null;
  used: number | null;
  remaining: number | null;
  resetAt?: string;
}
