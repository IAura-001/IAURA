import { iauraBrain } from "../brain";
import { conversationMemory } from "./ConversationMemory";

import type { AuraAssistantPlan } from "@/core/actions";
import { generateOpenAIResponse } from "@/services/openai";

export class ConversationController {
  async send(
    message: string,
    userContext: string
  ): Promise<AuraAssistantPlan> {
    conversationMemory.add(
      "user",
      message
    );

    const history =
      conversationMemory.getHistory();

    const result = iauraBrain.analyze({
      message,
      userContext,
      history,
    });

    const response =
      await generateOpenAIResponse(
        result.prompt
      );

    conversationMemory.add(
      "assistant",
      response.content
    );

    return response;
  }
}

export const conversationController =
  new ConversationController();
