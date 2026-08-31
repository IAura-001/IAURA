"use client";

import { useState } from "react";
import type { CommercialNextAction } from "@/core/onboarding/commercialOnboarding";

const COPY: Record<CommercialNextAction, string> = {
  "continue-with-aura": "Continue with Aura",
  "build-brand-system": "Build the Brand System",
  "approve-first-visual": "Create the first visual",
  "develop-website-messaging": "Develop website messaging",
};

interface Props {
  hasProjectResult: boolean; hasDurableDirection: boolean;
  nextAction: CommercialNextAction; isBusy: boolean;
  onSaveDirection: () => Promise<void>;
  onNextAction: (action: CommercialNextAction) => void;
}

export default function CommercialActivationGuide({ hasProjectResult, hasDurableDirection,
  nextAction, isBusy, onSaveDirection, onNextAction }: Props) {
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  async function save() {
    if (isSaving) return;
    setSaveError(""); setIsSaving(true);
    try { await onSaveDirection(); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "The direction could not be saved."); }
    finally { setIsSaving(false); }
  }
  if (hasDurableDirection) return (
    <aside className="mb-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.06] p-4" aria-label="Launch foundation status">
      <p className="text-sm font-semibold text-emerald-100">Your launch foundation is started.</p>
      <p className="mt-1 text-sm text-zinc-400">The direction is saved to this project. You can leave and continue without rebuilding the context.</p>
      <button type="button" onClick={() => onNextAction(nextAction)} className="mt-3 min-h-11 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200">{COPY[nextAction]}</button>
    </aside>
  );
  return (
    <aside className="mb-5 rounded-2xl border border-violet-300/20 bg-violet-400/[0.05] p-4" aria-label="Launch setup status">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">Project → Direction → Continue</p>
      <p className="mt-2 text-sm text-zinc-300">{hasProjectResult ? "Aura has scoped the project. Save this direction so it remains part of your launch workspace." : "Your project is ready. Continue with Aura to clarify what matters first."}</p>
      {saveError ? <p className="mt-2 text-sm text-red-300" role="alert">{saveError}</p> : null}
      {hasProjectResult ? <button type="button" disabled={isBusy || isSaving} onClick={() => void save()} className="mt-3 min-h-11 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-50">{isSaving ? "Saving direction…" : "Save this direction"}</button> : null}
    </aside>
  );
}
