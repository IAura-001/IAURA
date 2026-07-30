import { iauraBrain } from "../brain";
import { conversationMemory } from "./ConversationMemory";

import { generateOpenAIResponse } from "@/services/openai";

export class ConversationController {
  async send(
    message: string,
    userContext: string
  ): Promise<string> {
    conversationMemory.add(
  "user",
  message
);

const history =
  conversationMemory.getHistory();

const result =
  iauraBrain.analyze({
    message,
    userContext,
    history,
  });

const content =
  await generateOpenAIResponse(
    result.prompt
  );

conversationMemory.add(
  "assistant",
  content
);

return content;
  }
}

export const conversationController =
  new ConversationController();