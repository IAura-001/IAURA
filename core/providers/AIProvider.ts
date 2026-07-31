import type {
  AuraAssistantPlan,
} from "@/core/actions";

export interface AIRequest {
  prompt: string;
  instructions?: string;
}

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
