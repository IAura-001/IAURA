import type { ChatMessage } from "@/types/chat";

export const INITIAL_CONVERSATION_WINDOW_SIZE = 10;
export const CONVERSATION_LOAD_OLDER_BATCH_SIZE = 10;

export function initialConversationVisibleStart(
  messageCount: number,
): number {
  return Math.max(0, messageCount - INITIAL_CONVERSATION_WINDOW_SIZE);
}

export function loadOlderConversationStart(
  currentStart: number,
): number {
  return Math.max(0, currentStart - CONVERSATION_LOAD_OLDER_BATCH_SIZE);
}

export function visibleConversationMessages(
  messages: ChatMessage[],
  visibleStartIndex: number,
): ChatMessage[] {
  return messages.slice(Math.max(0, visibleStartIndex));
}
