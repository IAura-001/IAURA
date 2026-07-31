"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { AuraPresence } from "@/components/aura/AuraPresence";
import Card from "@/components/ui/Card";
import { useI18n } from "@/core/i18n/I18nContext";
import type { MessageKey } from "@/core/i18n/messages";

type AssistantCardProps = {
  modeId?: string;
  onStart?: (
    mission: string
  ) => void | Promise<void>;
};

type AuraPhase = "idle" | "awakening";

export default function AssistantCard({
  modeId = "learn",
  onStart,
}: AssistantCardProps) {
  const { t } = useI18n();
  const [mission, setMission] = useState("");
  const [phase, setPhase] =
    useState<AuraPhase>("idle");
  const transitionTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
  const isAwakening = phase === "awakening";
  const modeName = t(
    `mode.${modeId}.name` as MessageKey
  );

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(
          transitionTimerRef.current
        );
      }
    };
  }, []);

  function beginAura(
    event?: FormEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    const cleanMission = mission.trim();

    if (isAwakening || !cleanMission) {
      return;
    }

    if (transitionTimerRef.current) {
      clearTimeout(
        transitionTimerRef.current
      );
    }

    setPhase("awakening");
    transitionTimerRef.current = setTimeout(
      () => {
        setMission("");
        setPhase("idle");
        void onStart?.(cleanMission);
      },
      720
    );
  }

  return (
    <Card
      glow
      className="relative min-w-0 overflow-hidden border-purple-300/10 bg-black/20 p-2 shadow-[0_24px_90px_rgba(30,10,70,0.32)]"
    >
      <div className="relative min-w-0 overflow-hidden rounded-[24px] border border-white/[0.07] bg-[radial-gradient(circle_at_50%_26%,rgba(91,33,182,0.14),rgba(2,1,8,0.82)_62%)] px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
        <div className="flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_14px_rgba(196,181,253,0.95)]"
            />
            <span className="text-[10px] font-medium uppercase tracking-[0.34em] text-zinc-500">
              Aura
            </span>
          </div>

          <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-medium tracking-[0.18em] text-zinc-400">
            {modeName}
          </span>
        </div>

        <AuraPresence phase={phase} />

        <form
          onSubmit={beginAura}
          className="relative mx-auto max-w-xl"
        >
          <div className="group flex min-w-0 items-center gap-3 rounded-[22px] border border-white/10 bg-black/45 p-2 pl-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_45px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition duration-300 focus-within:border-violet-300/35 focus-within:bg-black/55 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_36px_rgba(124,58,237,0.12)]">
            <span
              aria-hidden="true"
              className="shrink-0 text-sm text-violet-300/70 transition group-focus-within:text-violet-200"
            >
              ✦
            </span>

            <input
              value={mission}
              onChange={(event) =>
                setMission(event.target.value)
              }
              placeholder={t(
                "assistant.placeholder"
              )}
              aria-label={t(
                "assistant.placeholder"
              )}
              autoComplete="off"
              enterKeyHint="send"
              disabled={isAwakening}
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-zinc-600 disabled:opacity-60 sm:text-[15px]"
            />

            <button
              type="submit"
              disabled={
                isAwakening || !mission.trim()
              }
              aria-label={t("assistant.start")}
              title={t("assistant.start")}
              className="group/send flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-200/15 bg-gradient-to-br from-violet-500 to-blue-600 text-white shadow-[0_10px_28px_rgba(91,33,182,0.32)] transition duration-300 hover:scale-[1.04] hover:shadow-[0_12px_34px_rgba(99,102,241,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 disabled:cursor-not-allowed disabled:opacity-25"
            >
              {isAwakening ? (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border border-white/40 border-t-white"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-300 group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 19 19 5" />
                  <path d="M8 5h11v11" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </Card>
  );
}
