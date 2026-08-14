"use client";

import { useState } from "react";
import type {
  AuraExperienceChoice,
  BetaExecutionEvaluation,
} from "@/core/actions";

interface BetaExecutionEvaluationCardProps {
  evaluation: BetaExecutionEvaluation;
  choices?: AuraExperienceChoice[];
  sourceMessageId: string;
  verified?: boolean;
  disabled?: boolean;
  onChoose?: (
    choice: AuraExperienceChoice,
    sourceMessageId: string,
  ) => void | Promise<void>;
}

const resultLabels = {
  passed: "Exitosa",
  failed: "Fallida",
  partial: "Parcial",
} as const;

export function BetaExecutionEvaluationCard({
  evaluation,
  choices = [],
  sourceMessageId,
  verified = false,
  disabled = false,
  onChoose,
}: BetaExecutionEvaluationCardProps) {
  const [pendingChoice, setPendingChoice] = useState<number | null>(null);
  const [verifiedLocally, setVerifiedLocally] = useState(false);
  const isVerified = verified || verifiedLocally;

  async function choose(index: number, choice: AuraExperienceChoice): Promise<void> {
    if (!onChoose || disabled || pendingChoice !== null || isVerified) return;
    setPendingChoice(index);
    try {
      await onChoose(choice, sourceMessageId);
      if (choice.confirmation?.kind === "beta-execution-evaluation") {
        setVerifiedLocally(true);
      }
    } catch {
      // HomePage renders the existing conversation error state.
    } finally {
      setPendingChoice(null);
    }
  }

  return (
    <section
      aria-label={isVerified ? "Evaluación verificada" : "Evaluación provisional"}
      className="mt-5 overflow-hidden rounded-2xl border border-blue-400/20 bg-blue-500/[0.04]"
    >
      <header className="border-b border-white/[0.07] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
          {isVerified ? "Evaluación verificada" : "Evaluación provisional"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {isVerified
            ? "Evidencia confirmada por el fundador"
            : "Revisa esta interpretación antes de confirmarla"}
        </p>
      </header>
      <dl className="divide-y divide-white/[0.07]">
        <div className="px-5 py-4">
          <dt className="text-xs font-medium text-zinc-500">Observación</dt>
          <dd className="mt-1.5 whitespace-pre-wrap leading-6 text-zinc-200">
            {evaluation.observation}
          </dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-xs font-medium text-zinc-500">Resultado</dt>
          <dd className="mt-1.5 text-zinc-200">{resultLabels[evaluation.result]}</dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-xs font-medium text-zinc-500">Criterio “Terminado cuando”</dt>
          <dd className="mt-1.5 text-zinc-200">
            {evaluation.doneWhenSatisfied ? "Cumplido" : "No cumplido"}
          </dd>
        </div>
      </dl>
      {!isVerified && choices.length ? (
        <div className="grid gap-2 border-t border-white/[0.07] p-5 sm:grid-cols-2">
          {choices.map((choice, index) => (
            <button
              key={`${choice.label}-${index}`}
              type="button"
              disabled={disabled || !onChoose || pendingChoice !== null}
              aria-busy={pendingChoice === index}
              onClick={() => void choose(index, choice)}
              className="min-h-[4.5rem] rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5 text-left transition hover:border-blue-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-sm font-medium text-zinc-100">{choice.label}</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-500">
                {pendingChoice === index ? "Confirmando…" : choice.description}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
