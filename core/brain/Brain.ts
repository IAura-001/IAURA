import { buildBrainContext } from "../context/ContextBuilder";
import { makeBrainDecision } from "../decision/DecisionEngine";
import { validateBrainResult } from "../validator/ResponseValidator";

import type {
  BrainInput,
  BrainResult,
} from "./types";

export class Brain {
  analyze(input: BrainInput): BrainResult {
    const context =
      buildBrainContext(input);

    const decision =
      makeBrainDecision(context);

    const validated =
      validateBrainResult(
        context,
        decision
      );

    return {
      context,
      decision,
      validated,
    };
  }
}

export const iauraBrain = new Brain();