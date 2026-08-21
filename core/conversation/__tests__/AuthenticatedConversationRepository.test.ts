import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthenticatedConversationRepository } from "../AuthenticatedConversationRepository";
import { LocalConversationRepository } from "../ConversationRepository";

describe("AuthenticatedConversationRepository", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses an in-memory working copy and persists the user message remotely", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const repository = new AuthenticatedConversationRepository();
    repository.configure("user-a", null);

    const created = repository.createConversation({
      conversationId: "conversation-a",
      projectId: "project-a",
    });
    expect(created.ok).toBe(true);
    expect(repository.appendMessage("conversation-a", {
      role: "user",
      content: "Persist this message",
    }).ok).toBe(true);
    await expect(repository.flush()).resolves.toBeUndefined();

    expect(setItem).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/conversations", expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("Persist this message"),
    }));
    setItem.mockRestore();
  });

  it("fails closed when the remote conversation write is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({
        code: "42501",
        error: "Unable to persist conversation state.",
      }),
    }));
    const repository = new AuthenticatedConversationRepository();
    repository.configure("user-a", null);
    const created = repository.createConversation({ conversationId: "conversation-a" });
    expect(created.ok).toBe(true);

    await expect(repository.flush()).rejects.toThrow("Conversation persistence failed");
    expect(repository.getLastOperationResult()).toMatchObject({
      ok: false,
      code: "IAURA_STATE_PERSISTENCE_FAILED",
    });
  });

  it("does not queue a stale snapshot when the active conversation is unchanged", async () => {
    const remote = new LocalConversationRepository({
      synchronize: false,
      persistLocally: false,
    });
    remote.createConversation({
      conversationId: "conversation-a",
      projectId: "project-a",
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const repository = new AuthenticatedConversationRepository();
    repository.configure("user-a", remote.getSnapshot());

    expect(repository.setActiveConversation("conversation-a")).toMatchObject({
      ok: true,
      outcome: "unchanged",
    });
    await repository.flush();
    expect(fetchMock).not.toHaveBeenCalled();

    expect(repository.appendMessage("conversation-a", {
      role: "user",
      content: "Hola Aura",
    })).toMatchObject({ ok: true, outcome: "committed" });
    await repository.flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      expectedRevision: number;
      snapshot: { revision: number };
    };
    expect(body.expectedRevision).toBe(remote.getRevision());
    expect(body.snapshot.revision).toBe(remote.getRevision() + 1);
  });

  it("persists user and assistant snapshots with consecutive CAS revisions", async () => {
    const remote = new LocalConversationRepository({
      synchronize: false,
      persistLocally: false,
    });
    remote.createConversation({ conversationId: "conversation-a" });
    let remoteRevision = remote.getRevision();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        expectedRevision: number;
        snapshot: { revision: number };
      };
      if (body.expectedRevision !== remoteRevision) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ code: "IAURA_STATE_STALE_WRITE" }),
        };
      }
      remoteRevision = body.snapshot.revision;
      return { ok: true };
    });
    vi.stubGlobal("fetch", fetchMock);
    const repository = new AuthenticatedConversationRepository();
    repository.configure("user-a", remote.getSnapshot());

    repository.setActiveConversation("conversation-a");
    repository.appendMessage("conversation-a", {
      role: "user",
      content: "Hola Aura",
    });
    await expect(repository.flush()).resolves.toBeUndefined();
    repository.appendMessage("conversation-a", {
      role: "assistant",
      content: "Hola. ¿En qué puedo ayudarte?",
    });
    await expect(repository.flush()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(remoteRevision).toBe(remote.getRevision() + 2);
  });
});
  it("reproduces the former user-message failure when browser storage rejects the snapshot", () => {
    const local = new LocalConversationRepository({ synchronize: false });
    const created = local.createConversation({ conversationId: "conversation-a" });
    expect(created.ok).toBe(true);
    const setItem = vi.spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); });

    expect(local.appendMessage("conversation-a", {
      role: "user",
      content: "This used to fail before reaching the API",
    })).toMatchObject({
      ok: false,
      code: "IAURA_STATE_STAGING_FAILED",
    });
    setItem.mockRestore();
  });
