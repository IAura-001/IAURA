import type {
  AuraAssistantPlan,
} from "@/core/actions";
import type {
  CognitiveRequest,
} from "@/core/brain";

export type AIRequest = CognitiveRequest;

export type AIResponse =
  AuraAssistantPlan & {
    provider: string;
    model: string;
  };

export interface AIProvider {
  readonly name: string;

  generate(
    request: CognitiveRequest,
  ): Promise<AIResponse>;
}