import { beforeEach, describe, expect, it } from "vitest";

import { LocalConversationRepository } from "@/core/conversation";
import {
  canApplyConversationHydration,
  didActiveProjectChange,
  loadVisibleConversation,
} from "../conversationHydration";
import {
  initialConversationVisibleStart,
  visibleConversationMessages,
} from "../conversationWindowing";

describe("project conversation hydration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps complete hydrated history while deriving a recent presentation window", () => {
    const conversations = new LocalConversationRepository();
    const created = conversations.createConversation({
      projectId: "long-project",
    }).conversation!;
    for (let index = 1; index <= 35; index += 1) {
      conversations.appendMessage(created.conversationId, {
        messageId: `long-${index}`,
        role: index % 2 === 0 ? "assistant" : "user",
        content: `Long message ${index}`,
      });
    }

    const reloaded = new LocalConversationRepository();
    const complete = loadVisibleConversation(reloaded, "long-project");
    const visible = visibleConversationMessages(
      complete,
      initialConversationVisibleStart(complete.length),
    );

    expect(reloaded.getActiveConversation("long-project")?.messages).toHaveLength(35);
    expect(complete).toHaveLength(35);
    expect(visible).toHaveLength(10);
    expect(visible[0].id).toBe("long-26");
    expect(visible.at(-1)?.id).toBe("long-35");
  });

  it("distinguishes a same-project object refresh from a real project change", () => {
    expect(didActiveProjectChange("project-a", "project-a")).toBe(false);
    expect(didActiveProjectChange("project-a", "project-b")).toBe(true);
    expect(didActiveProjectChange("project-a", null)).toBe(true);
  });

  it("rejects hydration after newer optimistic message activity", () => {
    expect(canApplyConversationHydration({
      requestedProjectId: "project-a",
      activeProjectId: "project-a",
      scheduledMessageGeneration: 4,
      currentMessageGeneration: 5,
    })).toBe(false);
  });

  it("rejects hydration requested for a project that is no longer active", () => {
    expect(canApplyConversationHydration({
      requestedProjectId: "project-a",
      activeProjectId: "project-b",
      scheduledMessageGeneration: 4,
      currentMessageGeneration: 4,
    })).toBe(false);
  });

  it("allows unchanged initial or project-change hydration exactly once", () => {
    expect(canApplyConversationHydration({
      requestedProjectId: "project-a",
      activeProjectId: "project-a",
      scheduledMessageGeneration: 0,
      currentMessageGeneration: 0,
    })).toBe(true);
  });

  it("restores persisted messages after repository reconstruction without duplicates", () => {
    const first = new LocalConversationRepository();
    const created = first.createConversation({
      conversationId: "conversation-a",
      projectId: "project-a",
    });
    first.appendMessage(created.conversation!.conversationId, {
      messageId: "message-a",
      role: "user",
      content: "Only once",
    });

    const reloaded = new LocalConversationRepository();

    expect(loadVisibleConversation(reloaded, "project-a")).toEqual([{
      id: "message-a",
      role: "user",
      content: "Only once",
    }]);
    expect(loadVisibleConversation(reloaded, "project-a")).toHaveLength(1);
  });

  it("switches A to B to A without leaking messages across projects", () => {
    const conversations = new LocalConversationRepository();
    const projectA = conversations.createConversation({
      conversationId: "conversation-a",
      projectId: "project-a",
    }).conversation!;
    conversations.appendMessage(projectA.conversationId, {
      messageId: "message-a",
      role: "user",
      content: "Project A only",
    });
    const projectB = conversations.createConversation({
      conversationId: "conversation-b",
      projectId: "project-b",
    }).conversation!;
    conversations.appendMessage(projectB.conversationId, {
      messageId: "message-b",
      role: "assistant",
      content: "Project B only",
    });

    expect(loadVisibleConversation(conversations, "project-a")[0].content)
      .toBe("Project A only");
    expect(loadVisibleConversation(conversations, "project-b")[0].content)
      .toBe("Project B only");
    expect(loadVisibleConversation(conversations, "project-a")[0].content)
      .toBe("Project A only");
    expect(loadVisibleConversation(conversations, "project-b"))
      .not.toEqual(expect.arrayContaining([
        expect.objectContaining({ content: "Project A only" }),
      ]));
  });

  it("reconstructs a persisted assistant card from validated experience data", () => {
    const conversations = new LocalConversationRepository();
    const created = conversations.createConversation({
      projectId: "project-a",
    }).conversation!;
    conversations.appendMessage(created.conversationId, {
      role: "assistant",
      content: "Open the project.",
      structuredResponse: {
        actionTypes: [],
        experienceKind: "project",
        recommendedSurface: "projects",
        experience: {
          kind: "project",
          title: "Continue",
          summary: "Resume the project.",
          phases: [],
          choices: [],
          recommendedSurface: "projects",
        },
      },
    });

    expect(loadVisibleConversation(
      new LocalConversationRepository(),
      "project-a",
    )[0].experience).toMatchObject({
      title: "Continue",
      recommendedSurface: "projects",
    });
  });

  it("hydrates a project-isolated next-step card from its assistant message", () => {
    const conversations = new LocalConversationRepository();
    const iaura = conversations.createConversation({ projectId: "iaura" }).conversation!;
    conversations.appendMessage(iaura.conversationId, {
      role: "assistant",
      content: "Recommended.",
      structuredResponse: {
        actionTypes: [], experienceKind: "project", recommendedSurface: "presence",
        betaNextStep: {
          action: "Ship one card", whyNow: "The outcome is clear",
          result: "A visible recommendation", doneWhen: "It survives reload",
        },
      },
    });
    conversations.createConversation({ projectId: "nova" });

    expect(loadVisibleConversation(conversations, "iaura")[0].betaNextStep)
      .toEqual({
        action: "Ship one card", whyNow: "The outcome is clear",
        result: "A visible recommendation", doneWhen: "It survives reload",
      });
    expect(loadVisibleConversation(conversations, "nova")).toEqual([]);
  });

  it("hydrates confirmed state only onto its trusted source recommendation", () => {
    const conversations = new LocalConversationRepository();
    const conversation = conversations.createConversation({ projectId: "iaura" }).conversation!;
    conversations.appendMessage(conversation.conversationId, {
      messageId: "source", role: "assistant", content: "Next",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        betaNextStep: { action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible" },
      },
    });
    conversations.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        version: 1, status: "ready-to-start",
        confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
        confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
        confirmedNextStep: { action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible", sourceMessageId: "source", confirmedAt: "2026-08-13T12:02:00Z" },
      },
    });

    expect(loadVisibleConversation(new LocalConversationRepository(), "iaura")[0])
      .toMatchObject({ id: "source", betaNextStepConfirmed: true });
  });

  it("hydrates a persisted session decision onto the confirmed step", () => {
    const conversations = new LocalConversationRepository();
    const conversation = conversations.createConversation({ projectId: "iaura" }).conversation!;
    conversations.appendMessage(conversation.conversationId, {
      messageId: "step", role: "assistant", content: "Next",
      structuredResponse: { actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        betaNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D" } },
    });
    conversations.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "deferred",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "step", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "continue-later", sourceMessageId: "decision", decidedAt: "2026-08-13T12:03:00Z" },
    } });
    expect(loadVisibleConversation(new LocalConversationRepository(), "iaura")[0])
      .toMatchObject({ betaNextStepConfirmed: true, betaSessionDecision: "continue-later" });
  });
});
