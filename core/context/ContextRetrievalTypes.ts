export type ContextSource =
  | "conversation"
  | "memory"
  | "session"
  | "system";

export interface ContextRetrievalRequest {
  userId: string;
  conversationId: string;
  projectId?: string;
  message: string;
  sessionId?: string;
  requestedAt?: Date;
}

export interface RetrievedContextItem {
  id: string;
  source: ContextSource;
  content: string;
  relevanceScore: number;
  createdAt?: Date;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ContextPackage {
  query: string;
  items: RetrievedContextItem[];
  totalCandidates: number;
  truncated: boolean;
  generatedAt: Date;
}

export interface MemoryContextSource {
  retrieveRelevantMemories(input: {
    userId: string;
    conversationId?: string;
    projectId?: string;
    query: string;
    limit: number;
  }): Promise<RetrievedContextItem[]>;
}

export interface ConversationContextSource {
  getRecentContext(input: {
    conversationId: string;
    limit: number;
  }): Promise<RetrievedContextItem[]>;
}

export interface ContextRetrievalPolicy {
  conversationLimit: number;
  memoryLimit: number;
  totalLimit: number;
  minimumRelevanceScore: number;
}
