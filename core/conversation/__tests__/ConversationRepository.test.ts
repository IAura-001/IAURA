import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONVERSATION_BACKUP_STORAGE_KEY,
  CONVERSATION_STATE_STORAGE_KEY,
  CONVERSATION_STATE_VERSION,
  LEGACY_CONVERSATION_STORAGE_KEYS,
  LocalConversationRepository,
  MAX_COMPLETED_BETA_WORKFLOWS,
  MAX_WORKING_HISTORY_CHARACTERS,
  MAX_WORKING_HISTORY_MESSAGES,
  type Conversation,
} from "../ConversationRepository";

function repository(options: { synchronize?: boolean; writerId?: string } = {}) {
  let id = 0;
  let tick = 0;
  return new LocalConversationRepository({
    ...options,
    idFactory: () => `test-${++id}`,
    now: () =>
      new Date(Date.UTC(2026, 7, 2, 12, 0, tick++)).toISOString(),
  });
}

function createConversation(
  repo: LocalConversationRepository,
  input: { conversationId?: string; projectId?: string; title?: string } = {},
): Conversation {
  const result = repo.createConversation(input);
  expect(result.ok).toBe(true);
  expect(result.conversation).toBeDefined();
  return result.conversation as Conversation;
}

describe("LocalConversationRepository", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("discards incomplete completed Beta workflows instead of activating them", () => {
    const repo = repository();
    const conversation = createConversation(repo, { projectId: "iaura" });
    repo.updateConversationMetadata(conversation.conversationId, {
      completedBetaWorkflows: Array.from(
        { length: MAX_COMPLETED_BETA_WORKFLOWS + 3 },
        () => ({ version: 1 as const, status: "closed" as const }),
      ),
    });
    const restored = repository().getActiveConversation("iaura");
    expect(restored?.completedBetaWorkflows).toBeUndefined();
    expect(restored?.betaWorkflow).toBeUndefined();
  });

  it("persists conversations, messages, association and the active id across reload", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "conversation-1",
      projectId: "project-1",
      title: "VAEORA",
    });
    expect(
      first.appendMessage(conversation.conversationId, {
        messageId: "message-1",
        role: "user",
        content: "Continue the launch.",
      }).ok,
    ).toBe(true);

    const reloaded = repository();

    expect(reloaded.getActiveConversation("project-1")).toMatchObject({
      conversationId: "conversation-1",
      projectId: "project-1",
      messages: [{ messageId: "message-1", content: "Continue the launch." }],
    });
  });

  it("keeps existing conversations without beta workflow metadata readable", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "pre-beta",
      projectId: "project-1",
    });
    first.appendMessage(conversation.conversationId, {
      role: "assistant",
      content: "Existing response",
      structuredResponse: {
        actionTypes: [],
        experienceKind: "general",
        recommendedSurface: "none",
      },
    });

    const restored = repository().getConversation("pre-beta");

    expect(restored?.betaWorkflow).toBeUndefined();
    expect(restored?.messages[0].structuredResponse).toEqual({
      actionTypes: [],
      experienceKind: "general",
      recommendedSurface: "none",
    });
  });

  it("persists valid v1 beta workflow metadata across reconstruction", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "beta-1",
      projectId: "project-1",
    });

    expect(first.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: { version: 1, status: "capturing" },
    }).ok).toBe(true);

    expect(repository().getConversation("beta-1")?.betaWorkflow).toEqual({
      version: 1,
      status: "capturing",
    });
  });

  it("persists confirmed context and outcome across reconstruction", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "confirmed-beta",
      projectId: "project-1",
    });
    first.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        version: 1,
        status: "recommended",
        confirmedContext: {
          goal: "Launch Beta 01",
          blocker: "The next step is unclear",
          summary: "Clarify the launch path",
          sourceMessageId: "context-message",
          confirmedAt: "2026-08-13T12:00:00.000Z",
        },
        confirmedOutcome: {
          outcome: "A one-sentence proposition",
          doneWhen: "It names user, problem and benefit",
          sourceMessageId: "outcome-message",
          confirmedAt: "2026-08-13T12:05:00.000Z",
        },
      },
    });

    expect(repository().getConversation("confirmed-beta")?.betaWorkflow)
      .toMatchObject({
        status: "recommended",
        confirmedContext: { sourceMessageId: "context-message" },
        confirmedOutcome: { sourceMessageId: "outcome-message" },
      });
  });

  it("persists an authoritative confirmed next step across reconstruction", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "confirmed-next-step", projectId: "iaura",
    });
    first.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        version: 1, status: "ready-to-start",
        confirmedContext: {
          goal: "Launch", blocker: "No step", summary: "Choose one",
          sourceMessageId: "context", confirmedAt: "2026-08-13T12:00:00.000Z",
        },
        confirmedOutcome: {
          outcome: "Working card", doneWhen: "Visible",
          sourceMessageId: "outcome", confirmedAt: "2026-08-13T12:05:00.000Z",
        },
        confirmedNextStep: {
          action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible",
          sourceMessageId: "recommendation", confirmedAt: "2026-08-13T12:10:00.000Z",
        },
      },
    });

    expect(repository().getActiveConversation("iaura")?.betaWorkflow)
      .toMatchObject({
        status: "ready-to-start",
        confirmedContext: { sourceMessageId: "context" },
        confirmedOutcome: { sourceMessageId: "outcome" },
        confirmedNextStep: {
          action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible",
          sourceMessageId: "recommendation", confirmedAt: "2026-08-13T12:10:00.000Z",
        },
      });
    expect(repository().getActiveConversation("nova")).toBeNull();
  });

  it.each([
    ["start-now", "started"],
    ["continue-later", "deferred"],
  ] as const)("persists session decision %s across reconstruction", (kind, status) => {
    const first = repository();
    const conversation = createConversation(first, { projectId: "iaura" });
    first.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status,
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind, sourceMessageId: "decision", decidedAt: "2026-08-13T12:03:00Z" },
    } });
    expect(repository().getActiveConversation("iaura")?.betaWorkflow).toMatchObject({
      status, confirmedNextStep: { action: "A" },
      sessionDecision: { kind, sourceMessageId: "decision", decidedAt: "2026-08-13T12:03:00Z" },
    });
  });

  it("persists provisional evaluation and immutable verified evidence", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "execution-evidence", projectId: "iaura",
    });
    first.appendMessage(conversation.conversationId, {
      messageId: "report-1", role: "user", content: "The card flickered.",
    });
    first.appendMessage(conversation.conversationId, {
      messageId: "evaluation-1", role: "assistant", content: "Review first attempt.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        sourceUserMessageId: "report-1",
        betaExecutionEvaluation: {
          result: "partial", observation: "The card flickered", doneWhenSatisfied: false,
        },
      },
    });
    first.appendMessage(conversation.conversationId, {
      messageId: "report", role: "user", content: "I tested the card.",
    });
    first.appendMessage(conversation.conversationId, {
      messageId: "evaluation", role: "assistant", content: "Review.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        sourceUserMessageId: "report",
        betaExecutionEvaluation: {
          result: "passed", observation: "The card is visible", doneWhenSatisfied: true,
        },
      },
    });
    first.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "evaluated",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
      verifiedExecutions: [
        {
          evidenceId: "evidence-1", result: "partial", observation: "The card flickered",
          doneWhenSatisfied: false, sourceUserMessageId: "report-1",
          sourceMessageId: "evaluation-1", verifiedAt: "2026-08-13T12:03:30Z",
        },
        {
          evidenceId: "evidence-2", result: "passed", observation: "The card is visible",
          doneWhenSatisfied: true, sourceUserMessageId: "report",
          sourceMessageId: "evaluation", verifiedAt: "2026-08-13T12:04:00Z",
        },
      ],
    } });

    const restored = repository().getConversation("execution-evidence")!;
    expect(restored.messages[3].structuredResponse).toMatchObject({
      sourceUserMessageId: "report",
      betaExecutionEvaluation: { result: "passed", doneWhenSatisfied: true },
    });
    expect(restored.betaWorkflow).toMatchObject({
      status: "evaluated",
      verifiedExecutions: [
        { evidenceId: "evidence-1", result: "partial" },
        { evidenceId: "evidence-2", sourceMessageId: "evaluation" },
      ],
    });
  });

  it("does not reconstruct evaluated without passing done-when evidence", () => {
    const first = repository();
    const conversation = createConversation(first, { projectId: "iaura" });
    first.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "evaluated",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
      verifiedExecutions: [{ evidenceId: "e", result: "partial", observation: "Not done", doneWhenSatisfied: false, sourceUserMessageId: "u", sourceMessageId: "a", verifiedAt: "2026-08-13T12:04:00Z" }],
    } });
    expect(repository().getActiveConversation("iaura")?.betaWorkflow?.status)
      .toBe("started");
  });

  it("persists and binds incomplete-execution recovery to its exact trusted evidence", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "recovery-persistence", projectId: "iaura",
    });
    first.appendMessage(conversation.conversationId, {
      messageId: "report", role: "user", content: "Partial result.",
    });
    first.appendMessage(conversation.conversationId, {
      messageId: "evaluation", role: "assistant", content: "Review.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        sourceUserMessageId: "report",
        betaExecutionEvaluation: {
          result: "partial", observation: "Partial result", doneWhenSatisfied: false,
        },
      },
    });
    first.appendMessage(conversation.conversationId, {
      messageId: "recovery", role: "assistant", content: "Choose recovery.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        experience: {
          kind: "decision", title: "Recovery", summary: "Same step", phases: [],
          choices: [{ label: "Continuar después", description: "Later", prompt: "Later", confirmation: {
            kind: "beta-incomplete-execution-recovery", decision: "retry-later",
          } }], recommendedSurface: "presence",
        },
      },
    });
    first.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "deferred",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
      verifiedExecutions: [{ evidenceId: "evidence", result: "partial", observation: "Partial result", doneWhenSatisfied: false, sourceUserMessageId: "report", sourceMessageId: "evaluation", verifiedAt: "2026-08-13T12:04:00Z" }],
      incompleteExecutionRecoveries: [{ decision: "retry-later", evidenceId: "evidence", sourceMessageId: "recovery", confirmedAt: "2026-08-13T12:05:00Z" }],
    } });

    const restored = repository().getConversation("recovery-persistence")!;
    expect(restored.betaWorkflow).toMatchObject({
      status: "deferred",
      verifiedExecutions: [{ evidenceId: "evidence" }],
      incompleteExecutionRecoveries: [{
        decision: "retry-later", evidenceId: "evidence", sourceMessageId: "recovery",
      }],
    });
    restored.betaWorkflow!.incompleteExecutionRecoveries![0].decision = "retry-now";
    expect(repository().getConversation("recovery-persistence")?.betaWorkflow
      ?.incompleteExecutionRecoveries?.[0].decision).toBe("retry-later");

    first.appendMessage(conversation.conversationId, {
      messageId: "resume", role: "assistant", content: "Resume?",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        experience: {
          kind: "decision", title: "Resume", summary: "Resume", phases: [],
          choices: [{ label: "Empezar ahora", description: "Resume", prompt: "Resume", confirmation: {
            kind: "beta-session-decision", decision: "start-now",
          } }], recommendedSurface: "presence",
        },
      },
    });
    first.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        ...first.getConversation(conversation.conversationId)!.betaWorkflow!,
        status: "started",
        sessionDecision: {
          kind: "start-now", sourceMessageId: "resume", decidedAt: "2026-08-13T12:06:00Z",
        },
      },
    });
    expect(repository().getConversation("recovery-persistence")?.betaWorkflow)
      .toMatchObject({
        status: "started",
        verifiedExecutions: [{ evidenceId: "evidence" }],
        incompleteExecutionRecoveries: [{
          decision: "retry-later", evidenceId: "evidence",
        }],
      });

    const stored = JSON.parse(
      window.localStorage.getItem(CONVERSATION_STATE_STORAGE_KEY) ?? "{}",
    ) as { conversations: Array<{ betaWorkflow: { incompleteExecutionRecoveries: unknown[] } }> };
    stored.conversations[0].betaWorkflow.incompleteExecutionRecoveries.push({
      decision: "retry-now", evidenceId: "missing", sourceMessageId: "forged",
      confirmedAt: "not-a-date",
    });
    window.localStorage.setItem(CONVERSATION_STATE_STORAGE_KEY, JSON.stringify(stored));
    expect(repository().getConversation("recovery-persistence")?.betaWorkflow
      ?.incompleteExecutionRecoveries).toHaveLength(1);
  });

  it("reconstructs trusted session evaluation and explicit closure source chains", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "closed-session", projectId: "iaura",
    });
    first.appendMessage(conversation.conversationId, {
      messageId: "report", role: "user", content: "The step passed.",
    });
    first.appendMessage(conversation.conversationId, {
      messageId: "step-evaluation", role: "assistant", content: "Step review.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        sourceUserMessageId: "report",
        betaExecutionEvaluation: {
          result: "passed", observation: "The step passed", doneWhenSatisfied: true,
        },
      },
    });
    first.appendMessage(conversation.conversationId, {
      messageId: "session-review", role: "assistant", content: "Session review.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        betaSessionEvaluation: { outcomeSatisfied: true, summary: "Outcome satisfied" },
      },
    });
    first.appendMessage(conversation.conversationId, {
      messageId: "close-source", role: "assistant", content: "Close?",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        experience: {
          kind: "decision", title: "Close", summary: "Close", phases: [],
          choices: [{ label: "Cerrar sesión", description: "Close", prompt: "Close", confirmation: {
            kind: "beta-session-closure",
          } }], recommendedSurface: "presence",
        },
      },
    });
    first.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "closed",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
      verifiedExecutions: [{ evidenceId: "e", result: "passed", observation: "The step passed", doneWhenSatisfied: true, sourceUserMessageId: "report", sourceMessageId: "step-evaluation", verifiedAt: "2026-08-13T12:04:00Z" }],
      sessionEvaluation: { outcomeSatisfied: true, summary: "Outcome satisfied", sourceMessageId: "session-review", confirmedAt: "2026-08-13T12:05:00Z" },
      sessionClosure: { sourceMessageId: "close-source", closedAt: "2026-08-13T12:06:00Z" },
    } });

    expect(repository().getConversation("closed-session")?.betaWorkflow).toMatchObject({
      status: "closed",
      sessionEvaluation: { outcomeSatisfied: true, sourceMessageId: "session-review" },
      sessionClosure: { sourceMessageId: "close-source" },
      verifiedExecutions: [{ evidenceId: "e" }],
    });
  });

  it("downgrades impossible closed state without a trusted closure source", () => {
    const first = repository();
    const conversation = createConversation(first, { projectId: "iaura" });
    first.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "closed",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
      sessionEvaluation: { outcomeSatisfied: true, summary: "Claim", sourceMessageId: "missing", confirmedAt: "2026-08-13T12:05:00Z" },
      sessionClosure: { sourceMessageId: "missing", closedAt: "2026-08-13T12:06:00Z" },
    } });
    expect(repository().getActiveConversation("iaura")?.betaWorkflow?.status)
      .toBe("started");
    expect(repository().getActiveConversation("iaura")?.betaWorkflow)
      .not.toHaveProperty("sessionClosure");
  });

  it("drops malformed confirmed fields and strips injected scope fields", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "normalized-beta",
      projectId: "project-a",
    });
    first.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        version: 1,
        status: "defining-outcome",
        projectId: "project-b",
        confirmedContext: {
          goal: "Launch",
          blocker: "",
          summary: "Summary",
          sourceMessageId: "provider-source",
          confirmedAt: "provider-time",
        },
        confirmedOutcome: {
          outcome: "Injected",
          doneWhen: "Injected",
          sourceMessageId: "provider-source",
          confirmedAt: "2026-08-13T12:00:00.000Z",
        },
      } as never,
    });

    const restored = repository().getConversation("normalized-beta");
    expect(restored?.projectId).toBe("project-a");
    expect(restored?.betaWorkflow).toEqual({ version: 1, status: "defining-outcome" });
  });

  it("never allows beta metadata to override the repository project association", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "trusted-scope",
      projectId: "project-a",
    });
    first.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        version: 1,
        status: "capturing",
        projectId: "project-b",
      } as never,
    });

    const restored = repository().getConversation("trusted-scope");

    expect(restored?.projectId).toBe("project-a");
    expect(restored?.betaWorkflow).toEqual({
      version: 1,
      status: "capturing",
    });
    expect(restored?.betaWorkflow).not.toHaveProperty("projectId");
  });

  it("drops malformed beta metadata without dropping its conversation", () => {
    const first = repository();
    createConversation(first, {
      conversationId: "safe-conversation",
      projectId: "project-a",
    });
    const stored = JSON.parse(
      window.localStorage.getItem(CONVERSATION_STATE_STORAGE_KEY) ?? "{}",
    ) as { conversations: Array<Record<string, unknown>> };
    stored.conversations[0].betaWorkflow = {
      version: 1,
      status: "provider-invented-status",
      projectId: "project-b",
    };
    window.localStorage.setItem(
      CONVERSATION_STATE_STORAGE_KEY,
      JSON.stringify(stored),
    );

    const restored = repository().getConversation("safe-conversation");

    expect(restored).toMatchObject({ projectId: "project-a" });
    expect(restored?.betaWorkflow).toBeUndefined();
  });

  it("fails safely without overwriting an unsupported future workflow version", () => {
    const first = repository();
    createConversation(first, { conversationId: "future-beta" });
    const stored = JSON.parse(
      window.localStorage.getItem(CONVERSATION_STATE_STORAGE_KEY) ?? "{}",
    ) as { conversations: Array<Record<string, unknown>> };
    stored.conversations[0].betaWorkflow = {
      version: 2,
      status: "capturing",
    };
    const future = JSON.stringify(stored);
    window.localStorage.setItem(CONVERSATION_STATE_STORAGE_KEY, future);

    const restored = repository();

    expect(restored.getConversation("future-beta")).toBeNull();
    expect(restored.createConversation()).toMatchObject({
      ok: false,
      code: "IAURA_STATE_UNSUPPORTED_VERSION",
    });
    expect(window.localStorage.getItem(CONVERSATION_STATE_STORAGE_KEY)).toBe(future);
  });

  it("persists only the validated complete assistant experience", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "structured",
      projectId: "project-a",
    });
    first.appendMessage(conversation.conversationId, {
      role: "assistant",
      content: "Choose a direction.",
      structuredResponse: {
        actionTypes: ["create_project"],
        experienceKind: "decision",
        recommendedSurface: "presence",
        experience: {
          kind: "decision",
          title: "Direction",
          summary: "Choose one durable direction.",
          phases: [{ title: "Review", description: "Review the choice." }],
          choices: [{
            label: "Founders",
            description: "Use founders as the audience.",
            prompt: "Continue with founders.",
            confirmation: {
              kind: "project-decision",
              content: "The audience is founders.",
              projectId: "provider-controlled-project",
            } as never,
          }],
          recommendedSurface: "presence",
        },
      },
    });

    const persisted = repository()
      .getConversation("structured")
      ?.messages[0].structuredResponse;

    expect(persisted?.experience).toEqual({
      kind: "decision",
      title: "Direction",
      summary: "Choose one durable direction.",
      phases: [{ title: "Review", description: "Review the choice." }],
      choices: [{
        label: "Founders",
        description: "Use founders as the audience.",
        prompt: "Continue with founders.",
        confirmation: {
          kind: "project-decision",
          content: "The audience is founders.",
        },
      }],
      recommendedSurface: "presence",
    });
    expect(persisted?.experience?.choices[0].confirmation)
      .not.toHaveProperty("projectId");
  });

  it("persists and reloads a complete assistant next-step proposal", () => {
    const first = repository();
    const conversation = createConversation(first, {
      conversationId: "next-step",
      projectId: "iaura",
    });
    first.appendMessage(conversation.conversationId, {
      role: "assistant",
      content: "One next step.",
      structuredResponse: {
        actionTypes: [],
        experienceKind: "project",
        recommendedSurface: "presence",
        betaNextStep: {
          action: "Build the recommendation card.",
          whyNow: "The outcome is confirmed.",
          result: "One next step is visible.",
          doneWhen: "It remains after reload.",
        },
      },
    });

    expect(repository().getActiveConversation("iaura")?.messages[0]
      .structuredResponse?.betaNextStep).toEqual({
        action: "Build the recommendation card.",
        whyNow: "The outcome is confirmed.",
        result: "One next step is visible.",
        doneWhen: "It remains after reload.",
      });
    expect(repository().getActiveConversation("nova")).toBeNull();
  });

  it("keeps two conversations and two project associations isolated", () => {
    const repo = repository();
    const first = createConversation(repo, {
      conversationId: "conversation-a",
      projectId: "project-a",
    });
    repo.appendMessage(first.conversationId, {
      role: "user",
      content: "Only project A",
    });
    const second = createConversation(repo, {
      conversationId: "conversation-b",
      projectId: "project-b",
    });
    repo.appendMessage(second.conversationId, {
      role: "user",
      content: "Only project B",
    });

    expect(repo.getActiveConversation("project-a")?.messages).toHaveLength(1);
    expect(repo.getActiveConversation("project-a")?.messages[0].content).toBe(
      "Only project A",
    );
    expect(repo.getActiveConversation("project-b")?.messages[0].content).toBe(
      "Only project B",
    );
  });

  it("supports a general conversation without assigning a project", () => {
    const repo = repository();
    const general = createConversation(repo, { conversationId: "general" });

    expect(general.projectId).toBeUndefined();
    expect(repo.getActiveConversation(null)?.conversationId).toBe("general");
  });

  it("keeps complete local history while enforcing the bounded working window", () => {
    const repo = repository();
    const conversation = createConversation(repo);
    for (let index = 0; index < MAX_WORKING_HISTORY_MESSAGES + 8; index += 1) {
      repo.appendMessage(conversation.conversationId, {
        messageId: `message-${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        content: `${index}-${"x".repeat(600)}`,
      });
    }

    const local = repo.getConversation(conversation.conversationId);
    const working = repo.getWorkingHistory(conversation.conversationId);
    const workingCharacters = working.reduce(
      (total, message) => total + message.content.length,
      0,
    );

    expect(local?.messages).toHaveLength(MAX_WORKING_HISTORY_MESSAGES + 8);
    expect(working.length).toBeLessThanOrEqual(MAX_WORKING_HISTORY_MESSAGES);
    expect(workingCharacters).toBeLessThanOrEqual(
      MAX_WORKING_HISTORY_CHARACTERS,
    );
    expect(working.at(-1)?.messageId).toBe(
      `message-${MAX_WORKING_HISTORY_MESSAGES + 7}`,
    );
    expect(working.some((message) => message.messageId === "message-0")).toBe(
      false,
    );
  });

  it("preserves verified receipt-bearing messages in the bounded window", () => {
    const repo = repository();
    const conversation = createConversation(repo);
    repo.appendMessage(conversation.conversationId, {
      messageId: "receipt-message",
      role: "assistant",
      content: "Verified project creation receipt.",
      verifiedActionReceiptReferences: ["receipt-1"],
    });
    for (let index = 0; index < 10; index += 1) {
      repo.appendMessage(conversation.conversationId, {
        messageId: `recent-${index}`,
        role: "assistant",
        content: `Recent ${index}`,
      });
    }

    expect(
      repo
        .getWorkingHistory(conversation.conversationId, {
          maxMessages: 3,
          maxCharacters: 200,
        })
        .map((message) => message.messageId),
    ).toContain("receipt-message");
  });

  it("excludes the current message from working history without truncating storage", () => {
    const repo = repository();
    const conversation = createConversation(repo);
    const content = "current-" + "z".repeat(20_000);
    const write = repo.appendMessage(conversation.conversationId, {
      messageId: "current-message",
      role: "user",
      content,
    });

    expect(
      repo.getWorkingHistory(conversation.conversationId, {
        excludeMessageId: "current-message",
      }),
    ).toEqual([]);
    expect(write.message?.content).toBe(content);
    expect(repo.getConversation(conversation.conversationId)?.messages[0].content).toBe(
      content,
    );
  });

  it("isolates one corrupted conversation without erasing valid records", () => {
    const now = "2026-08-02T12:00:00.000Z";
    window.localStorage.setItem(
      CONVERSATION_STATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: CONVERSATION_STATE_VERSION,
        revision: 3,
        updatedAt: now,
        writerId: "writer-a",
        migrationCompletedAt: now,
        activeConversationId: "valid",
        conversations: [
          {
            conversationId: "valid",
            title: "Valid",
            status: "active",
            createdAt: now,
            updatedAt: now,
            lastAccessedAt: now,
            revision: 1,
            messages: [],
          },
          { conversationId: "broken", messages: "not-an-array" },
        ],
      }),
    );

    const repo = repository();

    expect(repo.getConversation("valid")).not.toBeNull();
    expect(repo.getConversation("broken")).toBeNull();
    expect(repo.listConversations()).toHaveLength(1);
  });

  it("migrates legacy history once and remains idempotent", () => {
    window.localStorage.setItem(
      LEGACY_CONVERSATION_STORAGE_KEYS[0],
      JSON.stringify([
        { role: "user", content: "Legacy user" },
        { role: "assistant", content: "Legacy assistant" },
      ]),
    );

    const first = repository();
    const second = repository();

    expect(first.listConversations()).toHaveLength(1);
    expect(first.getActiveConversation(null)?.messages).toHaveLength(2);
    expect(second.listConversations()).toHaveLength(1);
    expect(second.getActiveConversation(null)?.messages).toHaveLength(2);
  });

  it("rejects unsupported future versions without overwriting them", () => {
    const future = JSON.stringify({
      schemaVersion: CONVERSATION_STATE_VERSION + 10,
      revision: 99,
    });
    window.localStorage.setItem(CONVERSATION_STATE_STORAGE_KEY, future);

    const repo = repository();
    const result = repo.createConversation();

    expect(result).toMatchObject({
      ok: false,
      code: "IAURA_STATE_UNSUPPORTED_VERSION",
      persisted: false,
    });
    expect(repo.clearAllConversations()).toMatchObject({
      ok: false,
      code: "IAURA_STATE_UNSUPPORTED_VERSION",
    });
    expect(window.localStorage.getItem(CONVERSATION_STATE_STORAGE_KEY)).toBe(
      future,
    );
  });

  it("recovers the last valid state from backup after canonical corruption", () => {
    const repo = repository();
    const conversation = createConversation(repo, {
      conversationId: "recoverable",
    });
    repo.appendMessage(conversation.conversationId, {
      messageId: "preserved",
      role: "user",
      content: "Preserve this",
    });
    repo.appendMessage(conversation.conversationId, {
      messageId: "latest",
      role: "assistant",
      content: "Latest response",
    });
    expect(window.localStorage.getItem(CONVERSATION_BACKUP_STORAGE_KEY)).not.toBeNull();
    window.localStorage.setItem(CONVERSATION_STATE_STORAGE_KEY, "{corrupted");

    const recovered = repository();

    expect(recovered.getConversation("recoverable")?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ messageId: "preserved" }),
      ]),
    );
    expect(recovered.getMigrationOutcome()).toBe("recovered");
  });

  it("does not report success or mutate memory when persistence fails", () => {
    const repo = repository();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation((key, value) => {
        if (key === CONVERSATION_STATE_STORAGE_KEY) {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        return Reflect.apply(
          window.localStorage.setItem,
          window.localStorage,
          [key, value],
        );
      });

    const result = repo.createConversation({ conversationId: "not-persisted" });

    expect(result.ok).toBe(false);
    expect(result.persisted).toBe(false);
    expect(repo.getConversation("not-persisted")).toBeNull();
    setItem.mockRestore();
  });

  it("rejects stale writes and refreshes to the newer validated history", () => {
    const first = repository({ writerId: "writer-a" });
    const conversation = createConversation(first, {
      conversationId: "shared",
    });
    const second = repository({ writerId: "writer-b" });
    const staleRevision = second.getRevision();
    first.appendMessage(conversation.conversationId, {
      messageId: "newer",
      role: "user",
      content: "Newer history",
    });

    const stale = second.appendMessage(
      conversation.conversationId,
      { messageId: "stale", role: "assistant", content: "Stale write" },
      staleRevision,
    );

    expect(stale).toMatchObject({
      ok: false,
      outcome: "conflict",
      code: "IAURA_STATE_STALE_WRITE",
    });
    expect(second.getConversation("shared")?.messages).toEqual([
      expect.objectContaining({ messageId: "newer" }),
    ]);
  });

  it("observes cross-tab message and archive updates without write loops", () => {
    const first = repository({ writerId: "writer-a" });
    const conversation = createConversation(first, {
      conversationId: "shared",
    });
    const second = repository({ synchronize: true, writerId: "writer-b" });
    const listener = vi.fn();
    second.subscribe(listener);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    first.appendMessage(conversation.conversationId, {
      messageId: "cross-tab",
      role: "user",
      content: "Cross-tab update",
    });
    const rawAfterMessage = window.localStorage.getItem(
      CONVERSATION_STATE_STORAGE_KEY,
    );
    const writesBeforeEvent = setItem.mock.calls.length;
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: CONVERSATION_STATE_STORAGE_KEY,
        newValue: rawAfterMessage,
      }),
    );

    expect(second.getConversation("shared")?.messages[0].messageId).toBe(
      "cross-tab",
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls).toHaveLength(writesBeforeEvent);

    first.archiveConversation("shared");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: CONVERSATION_STATE_STORAGE_KEY,
        newValue: window.localStorage.getItem(CONVERSATION_STATE_STORAGE_KEY),
      }),
    );
    expect(second.getActiveConversation()).toBeNull();
    second.dispose();
  });

  it("archives and deletes one conversation while selecting a valid fallback", () => {
    const repo = repository();
    const first = createConversation(repo, { conversationId: "first" });
    const second = createConversation(repo, { conversationId: "second" });

    expect(repo.archiveConversation(second.conversationId).ok).toBe(true);
    expect(repo.getActiveConversation()?.conversationId).toBe(first.conversationId);
    expect(repo.listConversations({ includeArchived: true })).toHaveLength(2);
    expect(repo.deleteConversation(first.conversationId).ok).toBe(true);
    expect(repo.getConversation(first.conversationId)).toBeNull();
    expect(repo.listConversations({ includeArchived: true })).toHaveLength(1);
  });

  it("clears all conversation data without touching unrelated storage", () => {
    window.localStorage.setItem("iaura.project-state", "preserve-projects");
    const repo = repository();
    createConversation(repo);

    expect(repo.clearAllConversations().ok).toBe(true);
    expect(repo.listConversations({ includeArchived: true })).toEqual([]);
    expect(repo.getActiveConversation()).toBeNull();
    expect(window.localStorage.getItem("iaura.project-state")).toBe(
      "preserve-projects",
    );
  });
});
