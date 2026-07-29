import type {
  BrainContext,
  BrainInput,
} from "../brain/types";

export function buildBrainContext(
  input: BrainInput
): BrainContext {
  return {
    message: input.message.trim(),
    userContext:
      input.userContext?.trim() ||
      "No additional user context available.",
    createdAt: new Date().toISOString(),
  };
}