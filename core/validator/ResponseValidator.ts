import type {
  BrainContext,
  BrainDecision,
} from "../brain/types";

export function validateBrainResult(
  context: BrainContext,
  decision: BrainDecision
): boolean {
  const hasMessage =
    context.message.length > 0;

  const hasDecision =
    decision.mode.length > 0 &&
    decision.reason.length > 0;

  return hasMessage && hasDecision;
}