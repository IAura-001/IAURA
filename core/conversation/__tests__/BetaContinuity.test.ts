import { beforeEach, describe, expect, it } from "vitest";

import {
  LocalConversationRepository,
  type Conversation,
  type BetaWorkflowMetadata,
} from "../ConversationRepository";
import { deferredContinuityProvenance, selectBetaContinuity } from "../BetaContinuity";

const confirmed = {
  confirmedContext: {
    goal: "Ship", blocker: "Unknown", summary: "Beta",
    sourceMessageId: "context", confirmedAt: "2026-08-14T10:00:00Z",
  },
  confirmedOutcome: {
    outcome: "A verified release", doneWhen: "Visible",
    sourceMessageId: "outcome", confirmedAt: "2026-08-14T10:01:00Z",
  },
  confirmedNextStep: {
    action: "Run the release test", whyNow: "Ready", result: "Result", doneWhen: "Visible",
    sourceMessageId: "step", confirmedAt: "2026-08-14T10:02:00Z",
  },
};

function workflow(
  status: BetaWorkflowMetadata["status"],
  extra: Partial<BetaWorkflowMetadata> = {},
): BetaWorkflowMetadata {
  return { version: 1, status, ...confirmed, ...extra };
}

function conversation(
  betaWorkflow?: BetaWorkflowMetadata,
  completedBetaWorkflows: BetaWorkflowMetadata[] = [],
  projectId = "project-a",
  messages: Conversation["messages"] = [],
): Conversation {
  return {
    conversationId: `conversation-${projectId}`, projectId, title: projectId,
    status: "active", createdAt: "2026-08-14T10:00:00Z",
    updatedAt: "2026-08-14T10:10:00Z", lastAccessedAt: "2026-08-14T10:10:00Z",
    revision: 1, messages,
    ...(betaWorkflow ? { betaWorkflow } : {}),
    ...(completedBetaWorkflows.length ? { completedBetaWorkflows } : {}),
  };
}

describe("Beta project continuity selector", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  it("projects no active cycle and trusted completed history without activating it", () => {
    const completed = workflow("closed", {
      sessionClosure: { sourceMessageId: "close", closedAt: "2026-08-14T10:08:00Z" },
      postClosureHandoff: {
        decision: "begin-another-cycle", sourceMessageId: "handoff",
        confirmedAt: "2026-08-14T10:09:00Z",
      },
    });
    expect(selectBetaContinuity(conversation(undefined, [completed]))).toMatchObject({
      state: "no-active-cycle",
      attemptCount: 0,
      completedCycleCount: 1,
      latestCompletedOutcome: "A verified release",
      primaryAction: { label: "Definir contexto" },
    });
  });

  it.each([
    ["capturing", "defining", "Continuar definición"],
    ["defining-outcome", "defining", "Continuar definición"],
    ["recommended", "recommended", "Revisar siguiente paso"],
    ["ready-to-start", "ready-to-start", "Empezar ahora"],
    ["evaluated", "evaluated", "Revisar sesión"],
  ] as const)("projects %s deterministically", (status, state, label) => {
    expect(selectBetaContinuity(conversation(workflow(status)))).toMatchObject({
      state, confirmedStep: "Run the release test", primaryAction: { label },
    });
  });

  it("summarizes a started workflow from trusted attempts only", () => {
    const active = workflow("started", {
      sessionDecision: {
        kind: "start-now", sourceMessageId: "start", decidedAt: "2026-08-14T10:03:00Z",
      },
      verifiedExecutions: [
        { evidenceId: "one", result: "failed", observation: "Failed", doneWhenSatisfied: false, sourceUserMessageId: "u1", sourceMessageId: "a1", verifiedAt: "2026-08-14T10:04:00Z" },
        { evidenceId: "two", result: "partial", observation: "Partial", doneWhenSatisfied: false, sourceUserMessageId: "u2", sourceMessageId: "a2", verifiedAt: "2026-08-14T10:05:00Z" },
      ],
      incompleteExecutionRecoveries: [
        { decision: "retry-now", evidenceId: "two", sourceMessageId: "recovery", confirmedAt: "2026-08-14T10:06:00Z" },
      ],
    });
    expect(selectBetaContinuity(conversation(active))).toMatchObject({
      state: "started", attemptCount: 2,
      latestTrustedResult: { outcome: "partial", doneWhenSatisfied: false },
      primaryAction: { label: "Reportar ejecución" },
    });
  });

  it("distinguishes recovery pending from a resolved incomplete attempt", () => {
    const evidence = [{
      evidenceId: "partial", result: "partial" as const, observation: "Partial",
      doneWhenSatisfied: false, sourceUserMessageId: "u", sourceMessageId: "a",
      verifiedAt: "2026-08-14T10:04:00Z",
    }];
    expect(selectBetaContinuity(conversation(workflow("started", {
      sessionDecision: { kind: "start-now", sourceMessageId: "start", decidedAt: "2026-08-14T10:03:00Z" },
      verifiedExecutions: evidence,
    })))).toMatchObject({
      state: "recovery-pending", primaryAction: { label: "Resolver recuperación" },
    });
  });

  it.each(["normal", "retry-later"] as const)(
    "projects deferred %s provenance with exactly one direct action",
    (kind) => {
      const active = workflow("deferred", kind === "normal"
        ? {
            sessionDecision: {
              kind: "continue-later", sourceMessageId: "defer",
              decidedAt: "2026-08-14T10:03:00Z",
            },
          }
        : {
            sessionDecision: {
              kind: "start-now", sourceMessageId: "start", decidedAt: "2026-08-14T10:03:00Z",
            },
            verifiedExecutions: [{ evidenceId: "partial", result: "partial", observation: "Partial", doneWhenSatisfied: false, sourceUserMessageId: "u", sourceMessageId: "a", verifiedAt: "2026-08-14T10:04:00Z" }],
            incompleteExecutionRecoveries: [{ decision: "retry-later", evidenceId: "partial", sourceMessageId: "recovery", confirmedAt: "2026-08-14T10:05:00Z" }],
          });
      const selected = selectBetaContinuity(conversation(active));
      expect(selected).toMatchObject({
        state: "deferred", primaryAction: { kind: "resume-deferred", label: "Retomar paso" },
      });
      expect(deferredContinuityProvenance(active))
        .toBe(kind === "normal" ? "defer" : "recovery");
    },
  );

  it("does not expose resume for malformed deferred state without trusted provenance", () => {
    expect(selectBetaContinuity(conversation(workflow("deferred"))).primaryAction)
      .toBeUndefined();
  });

  it.each([
    [undefined, "Elegir continuidad"],
    ["finish-here", undefined],
  ] as const)("projects closed handoff %s", (decision, label) => {
    const selected = selectBetaContinuity(conversation(workflow("closed", {
      sessionClosure: { sourceMessageId: "close", closedAt: "2026-08-14T10:08:00Z" },
      ...(decision
        ? { postClosureHandoff: { decision, sourceMessageId: "handoff", confirmedAt: "2026-08-14T10:09:00Z" } }
        : {}),
    })));
    expect(selected.state).toBe("closed");
    expect(selected.primaryAction?.label).toBe(label);
  });

  it("targets only the current post-closure handoff surface", () => {
    const handoffChoices = ["finish-here", "begin-another-cycle"].map(
      (decision) => ({
        id: decision,
        label: decision,
        description: decision,
        prompt: decision,
        confirmation: {
          kind: "beta-post-closure-handoff" as const,
          decision: decision as "finish-here" | "begin-another-cycle",
        },
      }),
    );
    const messages: Conversation["messages"] = [
      { messageId: "historical-handoff", role: "assistant", content: "Old", createdAt: "2026-08-14T09:00:00Z", structuredResponse: { actionTypes: [], experienceKind: "decision", recommendedSurface: "presence", experience: { kind: "decision", title: "Old", summary: "Old", phases: [], recommendedSurface: "presence", choices: handoffChoices } } },
      { messageId: "historical-recovery", role: "assistant", content: "Recovery", createdAt: "2026-08-14T09:01:00Z" },
      { messageId: "current-close", role: "assistant", content: "Closed", createdAt: "2026-08-14T10:08:00Z" },
      { messageId: "current-handoff", role: "assistant", content: "Choose", createdAt: "2026-08-14T10:09:00Z", structuredResponse: { actionTypes: [], experienceKind: "decision", recommendedSurface: "presence", experience: { kind: "decision", title: "Choose", summary: "Choose", phases: [], recommendedSurface: "presence", choices: handoffChoices } } },
    ];
    const selected = selectBetaContinuity(conversation(workflow("closed", {
      sessionClosure: { sourceMessageId: "current-close", closedAt: "2026-08-14T10:08:00Z" },
    }), [], "project-a", messages));
    expect(selected.primaryAction).toEqual({
      kind: "open-conversation",
      label: "Elegir continuidad",
      targetMessageId: "current-handoff",
    });
  });

  it("keeps project projections isolated", () => {
    const deferred = selectBetaContinuity(conversation(workflow("deferred", {
      sessionDecision: { kind: "continue-later", sourceMessageId: "defer", decidedAt: "2026-08-14T10:03:00Z" },
    }), [], "project-a"));
    const empty = selectBetaContinuity(conversation(undefined, [], "project-b"));
    expect(deferred).toMatchObject({ state: "deferred", confirmedStep: "Run the release test" });
    expect(empty).toMatchObject({ state: "no-active-cycle", attemptCount: 0 });
    expect(empty).not.toHaveProperty("confirmedStep");
  });

  it("reconstructs the same project-scoped continuity after repository hydration", () => {
    const first = new LocalConversationRepository();
    const created = first.createConversation({ projectId: "hydrated" }).conversation!;
    first.updateConversationMetadata(created.conversationId, {
      betaWorkflow: workflow("deferred", {
        sessionDecision: {
          kind: "continue-later", sourceMessageId: "defer",
          decidedAt: "2026-08-14T10:03:00Z",
        },
      }),
    });
    const reloaded = new LocalConversationRepository();
    expect(selectBetaContinuity(reloaded.getActiveConversation("hydrated"))).toMatchObject({
      state: "deferred", confirmedStep: "Run the release test",
      attemptCount: 0, completedCycleCount: 0,
      primaryAction: { kind: "resume-deferred", label: "Retomar paso" },
    });
    expect(selectBetaContinuity(reloaded.getActiveConversation("other")))
      .toMatchObject({ state: "no-active-cycle", attemptCount: 0 });
  });
});
