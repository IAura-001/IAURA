"use client";

import { useEffect, useMemo, useState } from "react";

import {
  conversationController,
  conversationRepository as localConversationRepository,
  deferredContinuityProvenance,
  selectBetaContinuity,
  type Conversation,
} from "@/core/conversation";
import { authenticatedConversationRepository as conversationRepository } from "@/core/conversation/AuthenticatedConversationRepository";

const continuityConversationRepository = process.env.NODE_ENV === "test"
  ? localConversationRepository
  : conversationRepository;

interface ProjectContinuityCardProps {
  projectId: string;
  onOpenConversation?: (targetMessageId?: string) => void;
}

const resultLabels = {
  passed: "Exitosa",
  partial: "Parcial",
  failed: "Fallida",
} as const;

export default function ProjectContinuityCard({
  projectId,
  onOpenConversation,
}: ProjectContinuityCardProps) {
  const [conversation, setConversation] = useState<Conversation | null>(() =>
    continuityConversationRepository.getActiveConversation(projectId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => {
      setConversation(continuityConversationRepository.getActiveConversation(projectId));
      setError("");
    };
    refresh();
    return continuityConversationRepository.subscribe(refresh);
  }, [projectId]);

  const continuity = useMemo(
    () => selectBetaContinuity(conversation),
    [conversation],
  );

  function reconcile(): void {
    setConversation(continuityConversationRepository.getActiveConversation(projectId));
  }

  async function activatePrimaryAction(): Promise<void> {
    const action = continuity.primaryAction;
    if (!action || isSubmitting) return;
    if (action.kind === "open-conversation") {
      onOpenConversation?.(action.targetMessageId);
      return;
    }

    const workflow = conversation?.betaWorkflow;
    const provenance = workflow
      ? deferredContinuityProvenance(workflow)
      : undefined;
    if (!conversation || !workflow?.confirmedNextStep || !provenance) {
      reconcile();
      setError("El estado cambió. Revisa la continuidad actual antes de continuar.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const updated = conversationController.resumeDeferredFromContinuity({
        projectId,
        conversationId: conversation.conversationId,
        expectedRevision: conversation.revision,
        stepSourceMessageId: workflow.confirmedNextStep.sourceMessageId,
        deferSourceMessageId: provenance,
      });
      setConversation(updated);
    } catch {
      reconcile();
      setError("El estado cambió. La acción anterior ya no está disponible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Continuidad del proyecto"
      data-continuity-state={continuity.state}
      className="mt-8 rounded-[24px] border border-violet-300/15 bg-violet-500/[0.055] p-5 sm:p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-violet-200/65">
            Continuidad Beta
          </p>
          <h3 className="mt-2 text-xl font-medium text-zinc-100">
            {continuity.title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {continuity.summary}
          </p>
          {continuity.confirmedStep ? (
            <p className="mt-3 truncate text-sm text-zinc-300">
              <span className="text-zinc-500">Paso confirmado:</span>{" "}
              {continuity.confirmedStep}
            </p>
          ) : null}
        </div>

        {continuity.primaryAction ? (
          <button
            type="button"
            disabled={isSubmitting ||
              (continuity.primaryAction.kind === "open-conversation" && !onOpenConversation)}
            aria-busy={isSubmitting}
            onClick={() => void activatePrimaryAction()}
            className="min-h-12 shrink-0 rounded-2xl border border-violet-300/25 bg-violet-400/[0.12] px-5 py-3 text-sm font-medium text-violet-100 transition hover:bg-violet-400/[0.18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Retomando…" : continuity.primaryAction.label}
          </button>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-2 border-t border-white/[0.07] pt-4 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-zinc-600">Último resultado</dt>
          <dd className="mt-1 text-zinc-300">
            {continuity.latestTrustedResult
              ? `${resultLabels[continuity.latestTrustedResult.outcome]} · ${
                  continuity.latestTrustedResult.doneWhenSatisfied
                    ? "criterio cumplido"
                    : "criterio pendiente"
                }`
              : "Sin intentos confirmados"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Intentos</dt>
          <dd className="mt-1 text-zinc-300">{continuity.attemptCount}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Ciclos completados</dt>
          <dd className="mt-1 text-zinc-300">
            {continuity.completedCycleCount}
            {continuity.latestCompletedOutcome
              ? ` · Último: ${continuity.latestCompletedOutcome}`
              : ""}
          </dd>
        </div>
      </dl>
      {error ? (
        <p role="alert" className="mt-3 text-xs text-amber-200/80">{error}</p>
      ) : null}
    </section>
  );
}
