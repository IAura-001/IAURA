"use client";

import { useState } from "react";
import type {
  AuraExperienceChoice,
  BetaPostClosureDecision,
  BetaSessionEvaluation,
} from "@/core/actions";

interface BetaSessionReviewCardProps {
  evaluation: BetaSessionEvaluation;
  choices?: AuraExperienceChoice[];
  sourceMessageId: string;
  confirmed?: boolean;
  closed?: boolean;
  handoffDecision?: BetaPostClosureDecision;
  disabled?: boolean;
  onChoose?: (choice: AuraExperienceChoice, sourceMessageId: string) => void | Promise<void>;
}

export function BetaSessionReviewCard({
  evaluation,
  choices = [],
  sourceMessageId,
  confirmed = false,
  closed = false,
  handoffDecision,
  disabled = false,
  onChoose,
}: BetaSessionReviewCardProps) {
  const [pendingChoice, setPendingChoice] = useState<number | null>(null);
  const [confirmedLocally, setConfirmedLocally] = useState(false);
  const [handoffDecisionLocally, setHandoffDecisionLocally] =
    useState<BetaPostClosureDecision | undefined>();
  const isConfirmed = confirmed || confirmedLocally || closed;
  const selectedHandoff = handoffDecision ?? handoffDecisionLocally;

  async function choose(index: number, choice: AuraExperienceChoice): Promise<void> {
    if (
      !onChoose || disabled || pendingChoice !== null ||
      (closed ? Boolean(selectedHandoff) : isConfirmed)
    ) return;
    setPendingChoice(index);
    try {
      await onChoose(choice, sourceMessageId);
      if (choice.confirmation?.kind === "beta-session-evaluation") {
        setConfirmedLocally(true);
      }
      if (choice.confirmation?.kind === "beta-post-closure-handoff") {
        setHandoffDecisionLocally(choice.confirmation.decision);
      }
    } catch {
      // HomePage owns the existing conversation error state.
    } finally {
      setPendingChoice(null);
    }
  }

  const heading = closed
    ? "Sesión cerrada"
    : isConfirmed
      ? "Evaluación de sesión confirmada"
      : "Revisión de sesión";

  return (
    <section
      aria-label={heading}
      data-nested-surface="dark"
      className="mt-5 overflow-hidden rounded-2xl border border-[var(--iaura-rich-dark-border)] bg-[var(--iaura-rich-dark-surface)] text-[var(--iaura-rich-dark-text)]"
    >
      <header className="border-b border-white/[0.07] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
          {heading}
        </p>
        <p className="mt-1 text-xs text-[var(--iaura-rich-dark-muted)]">
          {closed
            ? "Cierre confirmado explícitamente por el fundador"
            : isConfirmed
              ? "La sesión permanece abierta hasta una decisión explícita de cierre"
              : "Compara el resultado con el criterio confirmado de la sesión"}
        </p>
      </header>
      <dl className="divide-y divide-white/[0.07]">
        <div className="px-5 py-4">
          <dt className="text-xs font-medium text-[var(--iaura-rich-dark-muted)]">Resultado</dt>
          <dd className="mt-1.5 text-[var(--iaura-rich-dark-secondary)]">
            {evaluation.outcomeSatisfied
              ? "Objetivo de la sesión satisfecho"
              : "Aún no satisfecha"}
          </dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-xs font-medium text-[var(--iaura-rich-dark-muted)]">Resumen</dt>
          <dd className="mt-1.5 whitespace-pre-wrap leading-6 text-[var(--iaura-rich-dark-secondary)]">
            {evaluation.summary}
          </dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-xs font-medium text-[var(--iaura-rich-dark-muted)]">Estado</dt>
          <dd className="mt-1.5 text-[var(--iaura-rich-dark-secondary)]">
            {selectedHandoff === "finish-here"
              ? "Sesión cerrada · El fundador eligió terminar aquí"
              : selectedHandoff === "begin-another-cycle"
                ? "Sesión cerrada · El fundador comenzó otro ciclo"
                : closed
                  ? "Sesión cerrada"
                  : isConfirmed ? "Evaluación confirmada" : "Evaluación provisional"}
          </dd>
        </div>
      </dl>
      {((closed && !selectedHandoff) || !isConfirmed) && choices.length ? (
        <div className="grid gap-2 border-t border-white/[0.07] p-5 sm:grid-cols-2">
          {choices.filter((choice) =>
            !closed || choice.confirmation?.kind === "beta-post-closure-handoff"
          ).map((choice, index) => (
            <button
              key={`${choice.label}-${index}`}
              type="button"
              disabled={disabled || !onChoose || pendingChoice !== null}
              aria-busy={pendingChoice === index}
              onClick={() => void choose(index, choice)}
              className="min-h-[4.5rem] rounded-2xl border border-[var(--iaura-rich-dark-border)] bg-[var(--iaura-rich-dark-elevated)] p-3.5 text-left transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus)] disabled:cursor-not-allowed disabled:saturate-50"
            >
              <span className="text-sm font-medium text-[var(--iaura-rich-dark-text)]">{choice.label}</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--iaura-rich-dark-muted)]">
                {pendingChoice === index ? "Confirmando…" : choice.description}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
