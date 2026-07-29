import { iauraBrain } from "../brain";

import { generateOpenAIResponse } from "@/services/openai";

export class ConversationController {
  async send(
    message: string,
    userContext: string
  ): Promise<string> {
    const result =
      iauraBrain.analyze({
        message,
        userContext,
      });

    return generateOpenAIResponse(
      result.prompt
    );
  }
}

export const conversationController =
  new ConversationController();