import type { Conversation, BetaWorkflowMetadata } from "./ConversationRepository";

export type BetaContinuityState =
  | "no-active-cycle"
  | "defining"
  | "recommended"
  | "ready-to-start"
  | "started"
  | "recovery-pending"
  | "deferred"
  | "evaluated"
  | "closed";

export type BetaContinuityPrimaryActionKind =
  | "open-conversation"
  | "resume-deferred";

export interface BetaContinuityViewModel {
  state: BetaContinuityState;
  title: string;
  summary: string;
  confirmedStep?: string;
  latestTrustedResult?: {
    outcome: "passed" | "partial" | "failed";
    doneWhenSatisfied: boolean;
  };
  attemptCount: number;
  completedCycleCount: number;
  latestCompletedOutcome?: string;
  primaryAction?: {
    kind: BetaContinuityPrimaryActionKind;
    label: string;
    targetMessageId?: string;
  };
}

function pendingHandoffSource(
  conversation: Conversation,
  workflow: BetaWorkflowMetadata,
): string | undefined {
  const closureIndex = workflow.sessionClosure
    ? conversation.messages.findIndex(
        (message) => message.messageId === workflow.sessionClosure?.sourceMessageId,
      )
    : -1;
  if (closureIndex < 0) return undefined;
  return conversation.messages.findLast((message, index) => {
    if (index <= closureIndex || message.role !== "assistant") return false;
    const decisions = new Set(
      message.structuredResponse?.experience?.choices.flatMap((choice) =>
        choice.confirmation?.kind === "beta-post-closure-handoff"
          ? [choice.confirmation.decision]
          : []) ?? [],
    );
    return decisions.has("finish-here") && decisions.has("begin-another-cycle");
  })?.messageId;
}

function latestRecoveryFor(
  workflow: BetaWorkflowMetadata,
  evidenceId: string,
) {
  return workflow.incompleteExecutionRecoveries?.find(
    (recovery) => recovery.evidenceId === evidenceId,
  );
}

function baseHistory(conversation: Conversation | null) {
  const completed = conversation?.completedBetaWorkflows ?? [];
  const latestCompleted = completed.at(-1);
  return {
    completedCycleCount: completed.length,
    ...(latestCompleted?.confirmedOutcome?.outcome
      ? { latestCompletedOutcome: latestCompleted.confirmedOutcome.outcome }
      : {}),
  };
}

export function selectBetaContinuity(
  conversation: Conversation | null,
): BetaContinuityViewModel {
  const history = baseHistory(conversation);
  const workflow = conversation?.betaWorkflow;
  if (!workflow) {
    return {
      state: "no-active-cycle",
      title: "Sin ciclo Beta activo",
      summary: history.completedCycleCount
        ? "El último ciclo está preservado como historial. Puedes definir un contexto nuevo."
        : "Define el contexto para comenzar un ciclo Beta.",
      attemptCount: 0,
      ...history,
      primaryAction: { kind: "open-conversation", label: "Definir contexto" },
    };
  }

  const evidence = workflow.verifiedExecutions ?? [];
  const latestEvidence = evidence.at(-1);
  const common = {
    attemptCount: evidence.length,
    ...history,
    ...(workflow.confirmedNextStep?.action
      ? { confirmedStep: workflow.confirmedNextStep.action }
      : {}),
    ...(latestEvidence
      ? {
          latestTrustedResult: {
            outcome: latestEvidence.result,
            doneWhenSatisfied: latestEvidence.doneWhenSatisfied,
          },
        }
      : {}),
  };

  if (workflow.status === "recommended") {
    return {
      state: "recommended",
      title: "Siguiente paso por confirmar",
      summary: "La recomendación sigue siendo provisional hasta tu confirmación.",
      ...common,
      primaryAction: { kind: "open-conversation", label: "Revisar siguiente paso" },
    };
  }
  if (workflow.status === "ready-to-start") {
    return {
      state: "ready-to-start",
      title: "Paso listo para comenzar",
      summary: "El siguiente paso está confirmado y todavía no se ha iniciado.",
      ...common,
      primaryAction: { kind: "open-conversation", label: "Empezar ahora" },
    };
  }
  if (workflow.status === "deferred") {
    const provenance = deferredContinuityProvenance(workflow);
    return {
      state: "deferred",
      title: "Trabajo pausado",
      summary: "El mismo paso confirmado está preservado para retomarlo.",
      ...common,
      ...(provenance
        ? { primaryAction: { kind: "resume-deferred" as const, label: "Retomar paso" } }
        : {}),
    };
  }
  if (workflow.status === "evaluated") {
    return {
      state: "evaluated",
      title: "Resultado confirmado",
      summary: workflow.sessionEvaluation?.outcomeSatisfied
        ? "La evaluación está confirmada y el cierre explícito sigue pendiente."
        : "El resultado está confirmado y la revisión de sesión sigue abierta.",
      ...common,
      primaryAction: {
        kind: "open-conversation",
        label: workflow.sessionEvaluation?.outcomeSatisfied
          ? "Cerrar sesión"
          : "Revisar sesión",
      },
    };
  }
  if (workflow.status === "closed") {
    const handoff = workflow.postClosureHandoff?.decision;
    const handoffSource = conversation
      ? pendingHandoffSource(conversation, workflow)
      : undefined;
    return {
      state: "closed",
      title: "Ciclo cerrado",
      summary: handoff === "finish-here"
        ? "El fundador eligió terminar aquí; no hay ninguna acción pendiente."
        : handoff === "begin-another-cycle"
          ? "El ciclo está cerrado y su continuidad ya fue resuelta."
          : "La sesión está cerrada y falta elegir la continuidad.",
      ...common,
      ...(!handoff
        ? {
            primaryAction: {
              kind: "open-conversation" as const,
              label: "Elegir continuidad",
              ...(handoffSource ? { targetMessageId: handoffSource } : {}),
            },
          }
        : {}),
    };
  }
  if (workflow.status === "started") {
    const incomplete = latestEvidence &&
      (latestEvidence.result !== "passed" || !latestEvidence.doneWhenSatisfied);
    const recovery = latestEvidence
      ? latestRecoveryFor(workflow, latestEvidence.evidenceId)
      : undefined;
    if (incomplete && !recovery) {
      return {
        state: "recovery-pending",
        title: "Recuperación pendiente",
        summary: "El último intento fue incompleto. El mismo paso sigue activo y requiere una decisión.",
        ...common,
        primaryAction: { kind: "open-conversation", label: "Resolver recuperación" },
      };
    }
    return {
      state: "started",
      title: "Paso en ejecución",
      summary: latestEvidence
        ? "El mismo paso sigue activo. Reporta qué ocurrió en el siguiente intento."
        : "El paso está activo y espera el primer reporte de ejecución.",
      ...common,
      primaryAction: { kind: "open-conversation", label: "Reportar ejecución" },
    };
  }

  return {
    state: "defining",
    title: "Ciclo en definición",
    summary: workflow.status === "capturing"
      ? "El contexto del ciclo todavía debe confirmarse."
      : workflow.status === "defining-outcome"
        ? "El resultado de la sesión todavía debe confirmarse."
        : "Continúa la definición del ciclo en la conversación.",
    ...common,
    primaryAction: { kind: "open-conversation", label: "Continuar definición" },
  };
}

export function deferredContinuityProvenance(
  workflow: BetaWorkflowMetadata,
): string | undefined {
  if (workflow.status !== "deferred") return undefined;
  const latestEvidence = workflow.verifiedExecutions?.at(-1);
  const recovery = latestEvidence
    ? latestRecoveryFor(workflow, latestEvidence.evidenceId)
    : undefined;
  if (recovery?.decision === "retry-later") return recovery.sourceMessageId;
  return workflow.sessionDecision?.kind === "continue-later"
    ? workflow.sessionDecision.sourceMessageId
    : undefined;
}
