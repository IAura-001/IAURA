import {
  conversationRepository,
  type ConversationRepository,
} from "../conversation/ConversationRepository";
import {
  retrieveRelevantMemories,
} from "../memory/MemoryRetriever";
import type { MemoryEntry } from "../memory/MemoryTypes";

import type {
  ConversationContextSource,
  MemoryContextSource,
  RetrievedContextItem,
} from "./ContextRetrievalTypes";

function normalizeImportance(importance: number): number {
  if (!Number.isFinite(importance)) {
    return 0;
  }

  return Math.max(0, Math.min(1, importance));
}

function memoryToContextItem(
  memory: MemoryEntry,
): RetrievedContextItem {
  return {
    id: memory.id,
    source: "memory",
    content: memory.content,
    relevanceScore: normalizeImportance(memory.importance),
    createdAt: new Date(memory.updatedAt),
    metadata: {
      type: memory.type,
      tags: [...memory.tags],
    },
  };
}

export class LocalMemoryContextSource
implements MemoryContextSource {
  async retrieveRelevantMemories(input: {
    userId: string;
    conversationId?: string;
    query: string;
    limit: number;
  }): Promise<RetrievedContextItem[]> {
    return retrieveRelevantMemories(input.query)
      .slice(0, input.limit)
      .map(memoryToContextItem);
  }
}

export class LocalConversationContextSource
implements ConversationContextSource {
  constructor(
    private readonly conversations: ConversationRepository =
      conversationRepository,
  ) {}

  async getRecentContext(input: {
    conversationId: string;
    limit: number;
  }): Promise<RetrievedContextItem[]> {
    const messages = this.conversations.getWorkingHistory(
      input.conversationId,
      {
        maxMessages: input.limit,
      },
    );

    return messages.map((message, index) => ({
      id: message.messageId,
      source: "conversation" as const,
      content: message.content,
      relevanceScore: 1,
      createdAt: new Date(message.createdAt),
      metadata: {
        role: message.role,
        sequence: index,
      },
    }));
  }
}