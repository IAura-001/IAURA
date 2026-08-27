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
      className="mt-8 rounded-[24px] border border-[var(--project-border)] bg-[var(--project-surface-elevated)] p-5 text-[var(--project-text)] sm:p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--project-link)]">
            Continuidad Beta
          </p>
          <h3 className="mt-2 text-xl font-medium text-[var(--project-text)]">
            {continuity.title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--project-text-secondary)]">
            {continuity.summary}
          </p>
          {continuity.confirmedStep ? (
            <p className="mt-3 truncate text-sm text-[var(--project-text-secondary)]">
              <span className="text-[var(--project-metadata)]">Paso confirmado:</span>{" "}
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
            className="min-h-12 shrink-0 rounded-2xl border border-[var(--project-border-strong)] bg-[var(--project-action)] px-5 py-3 text-sm font-medium text-[var(--project-action-text)] transition hover:bg-[var(--project-action-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus)] disabled:cursor-not-allowed disabled:saturate-50"
          >
            {isSubmitting ? "Retomando…" : continuity.primaryAction.label}
          </button>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-2 border-t border-[var(--project-border)] pt-4 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-[var(--project-metadata)]">Último resultado</dt>
          <dd className="mt-1 text-[var(--project-text-secondary)]">
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
          <dt className="text-[var(--project-metadata)]">Intentos</dt>
          <dd className="mt-1 text-[var(--project-text-secondary)]">{continuity.attemptCount}</dd>
        </div>
        <div>
          <dt className="text-[var(--project-metadata)]">Ciclos completados</dt>
          <dd className="mt-1 text-[var(--project-text-secondary)]">
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
