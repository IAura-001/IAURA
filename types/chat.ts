import type { AuraExperience } from "@/core/actions";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  experience?: AuraExperience;
}
