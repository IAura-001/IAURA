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
