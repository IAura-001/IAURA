import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/types/chat";
import {
  CONVERSATION_LOAD_OLDER_BATCH_SIZE,
  INITIAL_CONVERSATION_WINDOW_SIZE,
  initialConversationVisibleStart,
  loadOlderConversationStart,
  visibleConversationMessages,
} from "@/components/pages/conversationWindowing";

function messages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `message-${index + 1}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `Message ${index + 1}`,
  }));
}

describe("conversation windowing", () => {
  it("shows only the most recent initial window without changing full state", () => {
    const complete = messages(36);
    const start = initialConversationVisibleStart(complete.length);

    expect(complete).toHaveLength(36);
    expect(visibleConversationMessages(complete, start).map(({ id }) => id))
      .toEqual(messages(36).slice(-INITIAL_CONVERSATION_WINDOW_SIZE).map(({ id }) => id));
  });

  it("loads older batches in order without duplicates and exhausts history", () => {
    const complete = messages(36);
    let start = initialConversationVisibleStart(complete.length);

    start = loadOlderConversationStart(start);
    expect(visibleConversationMessages(complete, start)).toHaveLength(
      INITIAL_CONVERSATION_WINDOW_SIZE + CONVERSATION_LOAD_OLDER_BATCH_SIZE,
    );
    start = loadOlderConversationStart(start);
    start = loadOlderConversationStart(start);
    const visible = visibleConversationMessages(complete, start);

    expect(start).toBe(0);
    expect(visible.map(({ id }) => id)).toEqual(complete.map(({ id }) => id));
    expect(new Set(visible.map(({ id }) => id)).size).toBe(36);
  });

  it("shows every short conversation", () => {
    const complete = messages(INITIAL_CONVERSATION_WINDOW_SIZE);
    const start = initialConversationVisibleStart(complete.length);

    expect(start).toBe(0);
    expect(visibleConversationMessages(complete, start)).toEqual(complete);
  });

  it("keeps the visible recent window when new messages append", () => {
    const complete = messages(30);
    const start = initialConversationVisibleStart(complete.length);
    const before = visibleConversationMessages(complete, start);
    const withNewMessages = [
      ...complete,
      { id: "new-user", role: "user" as const, content: "New user" },
      { id: "new-assistant", role: "assistant" as const, content: "New assistant" },
    ];
    const after = visibleConversationMessages(withNewMessages, start);

    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.slice(-2).map(({ id }) => id)).toEqual(["new-user", "new-assistant"]);
    expect(after).toHaveLength(INITIAL_CONVERSATION_WINDOW_SIZE + 2);
  });

  it("derives an independent recent window for each conversation", () => {
    const iaura = messages(32);
    const nova = messages(14).map((message) => ({
      ...message,
      id: `nova-${message.id}`,
    }));

    expect(visibleConversationMessages(
      iaura,
      initialConversationVisibleStart(iaura.length),
    ).every(({ id }) => !id.startsWith("nova-"))).toBe(true);
    expect(visibleConversationMessages(
      nova,
      initialConversationVisibleStart(nova.length),
    ).every(({ id }) => id.startsWith("nova-"))).toBe(true);
  });

  it("keeps a recommendation attached when its message is visible or revealed", () => {
    const complete = messages(21);
    complete[5] = {
      ...complete[5],
      role: "assistant",
      betaNextStepConfirmed: true,
      betaSessionDecision: "continue-later",
      betaNextStep: {
        action: "Build one card",
        whyNow: "The outcome is confirmed",
        result: "One recommendation appears",
        doneWhen: "The card is visible",
      },
    };
    complete[20] = { ...complete[20], betaNextStep: complete[5].betaNextStep };

    let start = initialConversationVisibleStart(complete.length);
    expect(visibleConversationMessages(complete, start).at(-1)?.betaNextStep)
      .toEqual(complete[5].betaNextStep);

    start = loadOlderConversationStart(start);
    expect(visibleConversationMessages(complete, start)
      .find(({ id }) => id === complete[5].id)?.betaNextStep)
      .toEqual(complete[5].betaNextStep);
    expect(visibleConversationMessages(complete, start)
      .find(({ id }) => id === complete[5].id)?.betaNextStepConfirmed)
      .toBe(true);
    expect(visibleConversationMessages(complete, start)
      .find(({ id }) => id === complete[5].id)?.betaSessionDecision)
      .toBe("continue-later");
  });
});
