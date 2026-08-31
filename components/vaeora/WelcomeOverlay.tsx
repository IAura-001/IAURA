"use client";

import { useState, type FormEvent } from "react";
import { normalizeLaunchIntent } from "@/core/onboarding/commercialOnboarding";

import styles from "./WelcomeOverlay.module.css";

interface WelcomeOverlayProps {
  userName: string;
  onLaunch: (intent: string) => Promise<void>;
  onSkip: () => void;
}

export default function WelcomeOverlay({
  userName,
  onLaunch,
  onSkip,
}: WelcomeOverlayProps) {
  const [intent, setIntent] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeLaunchIntent(intent);
    if (!normalized || isSubmitting) {
      setError("Tell Aura a little more about what you want to launch.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onLaunch(normalized);
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : "Your launch could not be started. Please retry.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="commercial-onboarding-title">
      <form className={styles.card} onSubmit={submit}>
        <span className={styles.badge}>
          VAEORA
        </span>

        <h1 className={styles.title} id="commercial-onboarding-title">
          What do you want to launch{userName ? `, ${userName}` : ""}?
        </h1>

        <p className={styles.description}>
          Tell Aura naturally. We’ll turn the intention into a real project, clarify what matters first, and save a direction you can continue later.
        </p>
        <label className="mt-7 block text-left text-sm font-semibold text-white/85" htmlFor="launch-intent">Your launch intention</label>
        <textarea id="launch-intent" className="mt-2 min-h-32 w-full resize-y rounded-[18px] border border-white/15 bg-black/30 px-4 py-3 text-left text-white outline-none placeholder:text-white/40 focus-visible:border-violet-300/70 focus-visible:ring-2 focus-visible:ring-violet-400/20" value={intent}
          onChange={(event) => setIntent(event.target.value)} rows={4}
          disabled={isSubmitting} autoFocus
          placeholder="I want to launch a premium skincare brand for busy women." />
        <p className="mt-2 text-left text-xs leading-5 text-white/45">A brand, service, digital product, offer, or another launch. A name is optional.</p>
        {error ? <p className="mt-2 text-left text-xs text-red-300" role="alert">{error}</p> : null}
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-[.68rem] text-white/40" aria-label="Launch setup progress">
          <span aria-current="step">Intent</span><span>Project</span><span>Direction</span><span>Continue</span>
        </div>
        <button className={styles.button} type="submit" disabled={isSubmitting || !intent.trim()}>
          {isSubmitting ? "Creating your launch project…" : "Turn this into a project"}
        </button>
        <button className="mt-3 min-h-10 border-0 bg-transparent px-3 text-xs text-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:opacity-50" type="button" onClick={onSkip} disabled={isSubmitting}>Use the workspace without setup</button>
      </form>
    </div>
  );
}
