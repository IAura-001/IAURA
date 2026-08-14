import type {
  AuraExperience,
  BetaNextStepRecommendation,
} from "@/core/actions";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  experience?: AuraExperience;
  betaNextStep?: BetaNextStepRecommendation;
}
