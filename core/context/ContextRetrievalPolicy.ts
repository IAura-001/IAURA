import type { ContextRetrievalPolicy } from "./ContextRetrievalTypes";

export const DEFAULT_CONTEXT_RETRIEVAL_POLICY: ContextRetrievalPolicy = {
  conversationLimit: 12,
  memoryLimit: 8,
  totalLimit: 16,
  minimumRelevanceScore: 0,
};

export function validateContextRetrievalPolicy(
  policy: ContextRetrievalPolicy,
): ContextRetrievalPolicy {
  const limits = [
    policy.conversationLimit,
    policy.memoryLimit,
    policy.totalLimit,
  ];

  if (
    limits.some(
      (value) =>
        !Number.isInteger(value) ||
        value <= 0,
    )
  ) {
    throw new Error("IAURA_CONTEXT_RETRIEVAL_POLICY_INVALID");
  }

  if (
    !Number.isFinite(policy.minimumRelevanceScore) ||
    policy.minimumRelevanceScore < 0 ||
    policy.minimumRelevanceScore > 1
  ) {
    throw new Error("IAURA_CONTEXT_RETRIEVAL_POLICY_INVALID");
  }

  if (
    policy.totalLimit >
    policy.conversationLimit + policy.memoryLimit
  ) {
    throw new Error("IAURA_CONTEXT_RETRIEVAL_POLICY_INVALID");
  }

  return { ...policy };
}