import type {
  MigrationOutcome,
  StateOperationResult,
} from "@/core/storage/StateReliability";

import {
  LocalConversationRepository,
  type AppendConversationMessageInput,
  type Conversation,
  type ConversationMessage,
  type ConversationMessageWriteResult,
  type ConversationMetadataUpdate,
  type ConversationRepository,
  type ConversationRepositorySnapshot,
  type ConversationWriteResult,
  type CreateConversationInput,
  type WorkingHistoryOptions,
} from "./ConversationRepository";

type Listener = () => void;

export class AuthenticatedConversationPersistenceError extends Error {
  constructor(readonly code: "IAURA_STATE_STALE_WRITE" | "IAURA_STATE_PERSISTENCE_FAILED") {
    super(code === "IAURA_STATE_STALE_WRITE"
      ? "Conversation state changed in another session."
      : "Conversation persistence failed.");
    this.name = "AuthenticatedConversationPersistenceError";
  }
}

export class AuthenticatedConversationRepository
  implements ConversationRepository
{
  private userId: string | null = null;

  private readonly local = new LocalConversationRepository({
    synchronize: false,
    persistLocally: false,
  });

  private pending: Promise<void> = Promise.resolve();

  private persistenceFailure: StateOperationResult | null = null;

  private listeners = new Set<Listener>();

  configure(
    userId: string,
    remoteSnapshot: ConversationRepositorySnapshot | null,
  ): void {
    if (this.userId === userId) {
      return;
    }

    this.userId = userId;
    this.persistenceFailure = null;

    if (remoteSnapshot) {
      this.local.replaceSnapshotResult(remoteSnapshot);
      this.notify();
      return;
    }

    this.local.clearAllConversations();
    this.notify();
  }

  reset(): void {
    this.userId = null;
    this.persistenceFailure = null;
    this.notify();
  }

  getAuthenticatedUserId(): string | null {
    return this.userId;
  }

  async flush(): Promise<void> {
    await this.pending;
    if (this.persistenceFailure) {
      throw new AuthenticatedConversationPersistenceError(
        this.persistenceFailure.code === "IAURA_STATE_STALE_WRITE"
          ? "IAURA_STATE_STALE_WRITE" : "IAURA_STATE_PERSISTENCE_FAILED",
      );
    }
  }

  private async reconcileRemoteSnapshot(): Promise<boolean> {
    const response = await fetch("/api/conversations", { method: "GET", cache: "no-store" });
    if (!response.ok) return false;
    const body = await response.json().catch(() => null) as { snapshot?: ConversationRepositorySnapshot | null } | null;
    if (!body?.snapshot) return false;
    const replaced = this.local.replaceSnapshotResult(body.snapshot);
    if (!replaced.ok) return false;
    this.notify();
    return true;
  }

  private queueSnapshot(
    snapshot: ConversationRepositorySnapshot,
  ): void {
    const scopedUser = this.userId;

    if (!scopedUser) {
      return;
    }

    this.pending = this.pending
      .catch(() => undefined)
      .then(async () => {
        if (
          !this.userId ||
          this.userId !== scopedUser
        ) {
          return;
        }

        const response = await fetch("/api/conversations", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            snapshot,
            expectedRevision: Math.max(0, snapshot.revision - 1),
          }),
        });

        if (!response.ok) {
          const failure = await response.json().catch(() => null) as {
            code?: unknown;
            error?: unknown;
          } | null;
          if (response.status === 409 && failure?.code === "IAURA_STATE_STALE_WRITE") {
            await this.reconcileRemoteSnapshot();
            throw new AuthenticatedConversationPersistenceError("IAURA_STATE_STALE_WRITE");
          }
          throw new Error(
            `Conversation persistence failed (${response.status}, ${String(failure?.code ?? "unknown")}): ${String(failure?.error ?? "unknown")}`,
          );
        }

        this.persistenceFailure = null;
      })
      .catch((error: unknown) => {
        const stale = error instanceof AuthenticatedConversationPersistenceError &&
          error.code === "IAURA_STATE_STALE_WRITE";
        this.persistenceFailure = {
          ok: false,
          outcome: "failed",
          revision: this.local.getRevision(),
          code: stale ? "IAURA_STATE_STALE_WRITE" : "IAURA_STATE_PERSISTENCE_FAILED",
        };

        this.notify();
      });
  }

  private persistIfSuccessful(
    result: StateOperationResult,
  ): void {
    if (
      !result.ok ||
      result.outcome !== "committed" ||
      !this.userId
    ) {
      return;
    }

    this.queueSnapshot(this.local.getSnapshot());
  }

  private persistWriteIfSuccessful(
    result: ConversationWriteResult,
  ): void {
    if (
      !result.ok ||
      result.outcome !== "committed" ||
      !this.userId
    ) {
      return;
    }

    this.queueSnapshot(this.local.getSnapshot());
  }

  private persistMessageIfSuccessful(
    result: ConversationMessageWriteResult,
  ): void {
    if (
      !result.ok ||
      result.outcome !== "committed" ||
      !this.userId
    ) {
      return;
    }

    this.queueSnapshot(this.local.getSnapshot());
  }

  getSnapshot(): ConversationRepositorySnapshot {
    return this.local.getSnapshot();
  }

  listConversations(
    options?: {
      includeArchived?: boolean;
    },
  ): Conversation[] {
    return this.local.listConversations(options);
  }

  getConversation(
    conversationId: string,
  ): Conversation | null {
    return this.local.getConversation(conversationId);
  }

  getActiveConversation(
    projectId?: string | null,
  ): Conversation | null {
    return this.local.getActiveConversation(projectId);
  }

  createConversation(
    input?: CreateConversationInput,
  ): ConversationWriteResult {
    const result = this.local.createConversation(input);
    this.persistWriteIfSuccessful(result);
    return result;
  }

  setActiveConversation(
    conversationId: string,
  ): StateOperationResult {
    const result =
      this.local.setActiveConversation(conversationId);

    this.persistIfSuccessful(result);

    return result;
  }

  appendMessage(
    conversationId: string,
    input: AppendConversationMessageInput,
    expectedRevision?: number,
  ): ConversationMessageWriteResult {
    const result = this.local.appendMessage(
      conversationId,
      input,
      expectedRevision,
    );

    this.persistMessageIfSuccessful(result);

    return result;
  }

  updateConversationMetadata(
    conversationId: string,
    update: ConversationMetadataUpdate,
  ): ConversationWriteResult {
    const result =
      this.local.updateConversationMetadata(
        conversationId,
        update,
      );

    this.persistWriteIfSuccessful(result);

    return result;
  }

  associateWithProject(
    conversationId: string,
    projectId: string | null,
  ): ConversationWriteResult {
    const result = this.local.associateWithProject(
      conversationId,
      projectId,
    );

    this.persistWriteIfSuccessful(result);

    return result;
  }

  archiveConversation(
    conversationId: string,
  ): StateOperationResult {
    const result =
      this.local.archiveConversation(conversationId);

    this.persistIfSuccessful(result);

    return result;
  }

  deleteConversation(
    conversationId: string,
  ): StateOperationResult {
    const result =
      this.local.deleteConversation(conversationId);

    this.persistIfSuccessful(result);

    return result;
  }

  clearAllConversations(): StateOperationResult {
    const result =
      this.local.clearAllConversations();

    this.persistIfSuccessful(result);

    return result;
  }

  getWorkingHistory(
    conversationId: string,
    options?: WorkingHistoryOptions,
  ): ConversationMessage[] {
    return this.local.getWorkingHistory(
      conversationId,
      options,
    );
  }

  getRevision(): number {
    return this.local.getRevision();
  }

  getMigrationOutcome(): MigrationOutcome {
    return this.local.getMigrationOutcome();
  }

  getLastOperationResult(): StateOperationResult {
    return (
      this.persistenceFailure ??
      this.local.getLastOperationResult()
    );
  }

  subscribe(
    listener: Listener,
  ): () => void {
    this.listeners.add(listener);

    const unsubscribeLocal =
      this.local.subscribe(listener);

    return () => {
      this.listeners.delete(listener);
      unsubscribeLocal();
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const authenticatedConversationRepository =
  new AuthenticatedConversationRepository();
