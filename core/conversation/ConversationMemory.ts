import {
  conversationRepository,
  type ConversationRepository,
} from "./ConversationRepository";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export class ConversationMemory {
  constructor(
    private readonly repository: ConversationRepository = conversationRepository,
  ) {}

  private resolveGeneralConversation() {
    const existing = this.repository.getActiveConversation(null);
    if (existing) return existing;

    const created = this.repository.createConversation({
      title: "General conversation",
    });
    if (!created.ok || !created.conversation) {
      throw new Error("IAURA could not persist the conversation.");
    }
    return created.conversation;
  }

  add(role: "user" | "assistant", content: string) {
    const conversation = this.resolveGeneralConversation();
    const result = this.repository.appendMessage(conversation.conversationId, {
      role,
      content,
    });
    if (!result.ok) {
      throw new Error("IAURA could not persist the conversation message.");
    }
  }

  getHistory(): ConversationMessage[] {
    return (
      this.repository
        .getActiveConversation(null)
        ?.messages.map(({ role, content }) => ({ role, content })) ?? []
    );
  }

  clear() {
    const result = this.repository.clearAllConversations();
    if (!result.ok) {
      throw new Error("IAURA could not clear conversation history.");
    }
  }
}

export const conversationMemory =
  new ConversationMemory();
