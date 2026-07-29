export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export class ConversationMemory {
  private messages: ConversationMessage[] = [];

  add(role: "user" | "assistant", content: string) {
    this.messages.push({ role, content });
  }

  getHistory(): ConversationMessage[] {
    return [...this.messages];
  }

  clear() {
    this.messages = [];
  }
}

export const conversationMemory =
  new ConversationMemory();