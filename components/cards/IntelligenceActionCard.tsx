"use client";

import { useState } from "react";
import type { AuraExperienceChoice } from "@/core/actions";
import { authenticatedProjectRepository } from "@/core/project/AuthenticatedProjectRepository";

export default function IntelligenceActionCard({
  choices, sourceMessageId, disabled = false, resolved: externallyResolved = false, onChoose,
  projectNameById = (projectId) => authenticatedProjectRepository.getProject(projectId)?.name ?? null,
}: {
  choices: AuraExperienceChoice[];
  sourceMessageId: string;
  disabled?: boolean;
  resolved?: boolean;
  onChoose?: (choice: AuraExperienceChoice, sourceMessageId: string) => void | Promise<void>;
  projectNameById?: (projectId: string) => string | null;
}) {
  const intelligenceChoices = choices.filter((choice) => choice.confirmation?.kind === "intelligence-action");
  const proposal = intelligenceChoices[0]?.confirmation?.kind === "intelligence-action"
    ? intelligenceChoices[0].confirmation.proposal : null;
  const [pending, setPending] = useState(false);
  const [locallyResolved, setResolved] = useState(false);
  const resolved = externallyResolved || locallyResolved;
  const [error, setError] = useState("");
  if (!proposal) return null;
  const projectDisplayName = proposal.scopeType === "project" && proposal.projectId
    ? projectNameById(proposal.projectId) ?? "Active project"
    : null;
  const reorderCurrent = proposal.operation === "intelligence_reorder_priorities"
    ? proposal.expectedPriorities.slice().sort((left, right) => left.position - right.position)
    : null;
  const reorderLabels = reorderCurrent
    ? new Map(reorderCurrent.map((priority) => [priority.recordId, priority.label]))
    : null;

  async function choose(choice: AuraExperienceChoice) {
    if (!onChoose || pending || resolved || disabled) return;
    setPending(true);
    setError("");
    try {
      await onChoose(choice, sourceMessageId);
      setResolved(true);
    } catch (choiceError) {
      setError(choiceError instanceof Error
        ? choiceError.message
        : "The choice could not be completed. Review the conversation state before trying again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-[24px] border border-violet-300/15 bg-[linear-gradient(145deg,rgba(34,20,66,0.72),rgba(4,4,10,0.92))] p-5 sm:p-6">
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-violet-200/65">Intelligence change proposed</p>
      <h3 className="mt-3 text-lg font-medium text-zinc-50">{proposal.operation.replace(/^intelligence_/, "").replaceAll("_", " ").toUpperCase()}</h3>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-zinc-500">Scope</dt><dd className="mt-1 text-zinc-200">{proposal.scopeType === "global" ? "Global" : `Project — ${projectDisplayName}`}</dd></div>
        {proposal.currentSummary ? <div><dt className="text-zinc-500">Current</dt><dd className="mt-1 whitespace-pre-wrap text-zinc-200">{reorderCurrent ? reorderCurrent.map((priority, index) => `${index + 1}. ${priority.label}`).join("\n") : proposal.currentSummary}</dd></div> : null}
        <div><dt className="text-zinc-500">Proposed</dt><dd className="mt-1 whitespace-pre-wrap text-zinc-100">{reorderLabels && proposal.operation === "intelligence_reorder_priorities" ? proposal.orderedPriorityIds.map((id, index) => `${index + 1}. ${reorderLabels.get(id)}`).join("\n") : proposal.proposedSummary}</dd></div>
      </dl>
      <div className="mt-5 grid gap-2 sm:grid-cols-2" aria-busy={pending}>
        {intelligenceChoices.map((choice) => (
          <button key={choice.label} type="button" disabled={disabled || pending || resolved || !onChoose}
            onClick={() => void choose(choice)}
            className="min-h-12 rounded-2xl border border-violet-300/20 bg-violet-500/[0.1] px-4 py-3 text-left text-sm font-medium text-violet-100 disabled:opacity-50">
            {pending ? "…" : resolved ? "✓" : choice.label}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-rose-200" role="alert">{error}</p> : null}
    </section>
  );
}
