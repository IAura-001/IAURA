"use client";

import { useState } from "react";
import type {
  AuraExperienceChoice,
  BetaNextStepRecommendation,
} from "@/core/actions";

interface BetaNextStepCardProps {
  recommendation: BetaNextStepRecommendation;
  choices?: AuraExperienceChoice[];
  sourceMessageId: string;
  confirmed?: boolean;
  disabled?: boolean;
  onChoose?: (choice: AuraExperienceChoice, sourceMessageId: string) => void | Promise<void>;
  sessionDecision?: "start-now" | "continue-later";
}

const details: Array<{
  key: keyof BetaNextStepRecommendation;
  label: string;
}> = [
  { key: "action", label: "Acción" },
  { key: "whyNow", label: "Por qué ahora" },
  { key: "result", label: "Resultado esperado" },
  { key: "doneWhen", label: "Terminado cuando" },
];

export function BetaNextStepCard({
  recommendation,
  choices = [],
  sourceMessageId,
  confirmed = false,
  disabled = false,
  onChoose,
  sessionDecision,
}: BetaNextStepCardProps) {
  const [pendingChoice, setPendingChoice] = useState<number | null>(null);
  const [chosenChoice, setChosenChoice] = useState<number | null>(null);
  const [confirmedLocally, setConfirmedLocally] = useState(false);
  const isConfirmed = confirmed || confirmedLocally;

  async function choose(index: number, choice: AuraExperienceChoice): Promise<void> {
    if (!onChoose || disabled || pendingChoice !== null || isConfirmed) return;
    setPendingChoice(index);
    try {
      await onChoose(choice, sourceMessageId);
      setChosenChoice(index);
      if (choice.confirmation?.kind === "beta-next-step") {
        setConfirmedLocally(true);
      }
    } catch {
      // HomePage renders the existing conversation error state.
    } finally {
      setPendingChoice(null);
    }
  }

  return (
    <section
      aria-label={isConfirmed ? "Siguiente paso confirmado" : "Siguiente paso recomendado"}
      data-nested-surface="dark"
      className="mt-5 overflow-hidden rounded-2xl border border-[var(--iaura-rich-dark-border)] bg-[var(--iaura-rich-dark-surface)] text-[var(--iaura-rich-dark-text)]"
    >
      <header className="border-b border-white/[0.07] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">
          {sessionDecision === "start-now"
            ? "Inicio confirmado"
            : sessionDecision === "continue-later"
              ? "Guardado para continuar después"
              : isConfirmed ? "Siguiente paso confirmado" : "Siguiente paso recomendado"}
        </p>
        <p className="mt-1 text-xs text-[var(--iaura-rich-dark-muted)]">
          {sessionDecision === "start-now"
            ? "Decisión de comenzar registrada; resultado todavía no verificado"
            : sessionDecision === "continue-later"
              ? "Paso confirmado y preservado; todavía no iniciado"
              : isConfirmed
            ? "Confirmado para continuar; todavía no iniciado"
            : "Una propuesta de Aura para avanzar ahora"}
        </p>
      </header>

      <dl className="divide-y divide-white/[0.07]">
        {details.map(({ key, label }) => (
          <div key={key} className="px-5 py-4">
            <dt className="text-xs font-medium text-[var(--iaura-rich-dark-muted)]">{label}</dt>
            <dd className="mt-1.5 whitespace-pre-wrap leading-6 text-[var(--iaura-rich-dark-secondary)]">
              {recommendation[key]}
            </dd>
          </div>
        ))}
      </dl>

      {!isConfirmed && choices.length ? (
        <div className="grid gap-2 border-t border-white/[0.07] p-5 sm:grid-cols-2">
          {choices.map((choice, index) => {
            const isPending = pendingChoice === index;
            const isChosen = chosenChoice === index;
            return (
              <button
                key={`${choice.label}-${index}`}
                type="button"
                onClick={() => void choose(index, choice)}
                disabled={disabled || !onChoose || pendingChoice !== null}
                aria-pressed={isChosen}
                aria-busy={isPending}
                data-state={isPending ? "loading" : isChosen ? "selected" : "ready"}
                className="min-h-[4.75rem] rounded-2xl border border-[var(--iaura-rich-dark-border)] bg-[var(--iaura-rich-dark-elevated)] p-3.5 text-left transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus)] disabled:cursor-not-allowed disabled:saturate-50"
              >
                <span className="text-sm font-medium text-[var(--iaura-rich-dark-text)]">
                  {choice.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--iaura-rich-dark-muted)]">
                  {isPending ? "Confirmando…" : choice.description}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
