import type {
  AuraAssistantPlan,
} from "@/core/actions";
import type { CognitiveRequest } from "@/core/brain";

export interface LegacyAIRequest {
  prompt: string;
  instructions?: string;
}

export type AIRequest =
  | CognitiveRequest
  | LegacyAIRequest;

export interface AIResponse
  extends AuraAssistantPlan {
  provider: string;
  model: string;
}

export interface AIProvider {
  readonly name: string;

  generate(
    request: AIRequest
  ): Promise<AIResponse>;
}
