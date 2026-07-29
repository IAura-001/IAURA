import type {
  BrainContext,
  BrainDecision,
} from "../brain/types";

export interface PromptBuildInput {
  context: BrainContext;
  decision: BrainDecision;
}

export class PromptBuilder {
  build({
    context,
    decision,
  }: PromptBuildInput): string {

    return `
You are IAURA.

Thinking Mode:
${decision.mode}

Reason:
${decision.reason}

User Context:
${context.userContext}

User Message:
${context.message}

Respond naturally as IAURA.

Do not reveal internal reasoning.

Do not mention Thinking Mode.

Do not mention Prompt.

Only answer the user.
`.trim();

  }
}

export const promptBuilder =
  new PromptBuilder();