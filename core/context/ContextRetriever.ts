import {
  DEFAULT_CONTEXT_RETRIEVAL_POLICY,
  validateContextRetrievalPolicy,
} from "./ContextRetrievalPolicy";

import type {
  ContextPackage,
  ContextRetrievalPolicy,
  ContextRetrievalRequest,
  ConversationContextSource,
  MemoryContextSource,
  RetrievedContextItem,
} from "./ContextRetrievalTypes";

export interface ContextRetrieverOptions {
  conversationSource: ConversationContextSource;
  memorySource: MemoryContextSource;
  policy?: ContextRetrievalPolicy;
  now?: () => Date;
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizedContent(value: string): string {
  return compactText(value).toLocaleLowerCase();
}

function sourcePriority(
  source: RetrievedContextItem["source"],
): number {
  switch (source) {
    case "conversation":
      return 0;
    case "memory":
      return 1;
    case "session":
      return 2;
    case "system":
      return 3;
  }
}

function validItem(
  item: RetrievedContextItem,
  minimumScore: number,
): boolean {
  return (
    typeof item.id === "string" &&
    item.id.trim().length > 0 &&
    typeof item.content === "string" &&
    compactText(item.content).length > 0 &&
    Number.isFinite(item.relevanceScore) &&
    item.relevanceScore >= minimumScore
  );
}

function compareItems(
  left: RetrievedContextItem,
  right: RetrievedContextItem,
): number {
  const relevance =
    right.relevanceScore - left.relevanceScore;

  if (relevance !== 0) {
    return relevance;
  }

  const source =
    sourcePriority(left.source) -
    sourcePriority(right.source);

  if (source !== 0) {
    return source;
  }

  const leftTime =
    left.createdAt?.getTime() ?? 0;
  const rightTime =
    right.createdAt?.getTime() ?? 0;

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return left.id.localeCompare(right.id);
}

function cloneItem(
  item: RetrievedContextItem,
): RetrievedContextItem {
  return {
    ...item,
    content: compactText(item.content),
    ...(item.createdAt
      ? { createdAt: new Date(item.createdAt) }
      : {}),
    ...(item.metadata
      ? { metadata: { ...item.metadata } }
      : {}),
  };
}

function deduplicate(
  items: RetrievedContextItem[],
): RetrievedContextItem[] {
  const ids = new Set<string>();
  const contents = new Set<string>();
  const result: RetrievedContextItem[] = [];

  for (const item of items) {
    const id = item.id.trim();
    const contentKey = normalizedContent(item.content);

    if (ids.has(id) || contents.has(contentKey)) {
      continue;
    }

    ids.add(id);
    contents.add(contentKey);
    result.push(cloneItem(item));
  }

  return result;
}

export class ContextRetriever {
  private readonly policy: ContextRetrievalPolicy;
  private readonly now: () => Date;

  constructor(
    private readonly options: ContextRetrieverOptions,
  ) {
    this.policy = validateContextRetrievalPolicy(
      options.policy ??
        DEFAULT_CONTEXT_RETRIEVAL_POLICY,
    );

    this.now = options.now ?? (() => new Date());
  }

  async retrieve(
    request: ContextRetrievalRequest,
  ): Promise<ContextPackage> {
    const query = compactText(request.message);

    if (
      !request.userId.trim() ||
      !request.conversationId.trim() ||
      !query
    ) {
      throw new Error(
        "IAURA_CONTEXT_RETRIEVAL_REQUEST_INVALID",
      );
    }

    const conversationPromise =
      this.options.conversationSource.getRecentContext({
        conversationId: request.conversationId,
        limit: this.policy.conversationLimit,
      });

    const memoryPromise =
      this.options.memorySource.retrieveRelevantMemories({
        userId: request.userId,
        conversationId: request.conversationId,
        query,
        limit: this.policy.memoryLimit,
      });

    const [conversationResult, memoryResult] =
      await Promise.allSettled([
        conversationPromise,
        memoryPromise,
      ]);

    if (
      conversationResult.status === "rejected" &&
      memoryResult.status === "rejected"
    ) {
      throw new Error(
        "IAURA_CONTEXT_RETRIEVAL_SOURCES_FAILED",
      );
    }

    const candidates = [
      ...(conversationResult.status === "fulfilled"
        ? conversationResult.value.slice(
            0,
            this.policy.conversationLimit,
          )
        : []),
      ...(memoryResult.status === "fulfilled"
        ? memoryResult.value.slice(
            0,
            this.policy.memoryLimit,
          )
        : []),
    ];

    const validCandidates = candidates.filter((item) =>
      validItem(
        item,
        this.policy.minimumRelevanceScore,
      ),
    );

    const ordered = deduplicate(validCandidates)
      .sort(compareItems);

    const items = ordered.slice(
      0,
      this.policy.totalLimit,
    );

    return {
      query,
      items,
      totalCandidates: candidates.length,
      truncated: ordered.length > items.length,
      generatedAt: new Date(
        request.requestedAt ?? this.now(),
      ),
    };
  }
}