import { assessAutonomy } from "../autonomy";
import { buildBrainContext } from "../context/ContextBuilder";
import { makeBrainDecision } from "../decision/DecisionEngine";
import { validateBrainResult } from "../validator/ResponseValidator";
import { promptBuilder } from "../prompt";
import type {
  BrainInput,
  BrainResult,
} from "./types";

export class Brain {
  analyze(input: BrainInput): BrainResult {
    const context = buildBrainContext(input);

    const decision = makeBrainDecision(context);
    const autonomy = assessAutonomy(context);

    const validated = validateBrainResult(
      context,
      decision
    );

    const prompt = promptBuilder.build({
      context,
      decision,
      autonomy,
      history: input.history,
    });

    return {
      context,
      decision,
      autonomy,
      prompt,
      validated,
    };
  }
}

export const iauraBrain = new Brain();
