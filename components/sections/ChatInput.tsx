"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import VoiceButton from "@/components/sections/VoiceButton";
import { useVoiceContext } from "@/core/context/VoiceContext";
import { useI18n } from "@/core/i18n/I18nContext";
import type { VoiceError } from "@/hooks/useVoice";

interface ChatInputProps {
  onSend: (
    message?: string
  ) => void | Promise<void>;
  isSending?: boolean;
  voiceEntryRequested?: boolean;
}

type SubmissionFeedback =
  | "idle"
  | "sending"
  | "success"
  | "error";

function getVoiceErrorKey(
  voiceError: VoiceError
) {
  switch (voiceError) {
    case "permission-denied":
      return "chat.permissionDenied" as const;
    case "transcription-failed":
      return "chat.transcriptionFailed" as const;
    case "unavailable":
      return "chat.voiceUnavailable" as const;
    default:
      return null;
  }
}

function ChatInputComponent({
  onSend,
  isSending = false,
  voiceEntryRequested = false,
}: ChatInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [submissionFeedback, setSubmissionFeedback] =
    useState<SubmissionFeedback>("idle");
  const lastTranscriptRef = useRef("");
  const feedbackTimerRef =
    useRef<number | null>(null);
  const audioInputRef =
    useRef<HTMLInputElement>(null);
  const voiceButtonRef =
    useRef<HTMLButtonElement>(null);
  const voiceEntryHintRef =
    useRef<HTMLParagraphElement>(null);
  const hasFocusedVoiceEntryRef =
    useRef(false);

  const {
    state,
    transcript,
    voiceMode,
    captureMode,
    voiceError,
    setVoiceMode,
    startListening,
    stopListening,
    stopSpeaking,
    transcribeAudioFile,
    clearTranscript,
    clearVoiceError,
    unlockAudio,
  } = useVoiceContext();
  const isSubmissionBusy =
    isSending || submissionFeedback === "sending";

  const scheduleFeedbackReset = useCallback(() => {
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      setSubmissionFeedback("idle");
      feedbackTimerRef.current = null;
    }, 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const trimmedTranscript =
      transcript.trim();

    if (
      !trimmedTranscript ||
      isSubmissionBusy ||
      trimmedTranscript ===
        lastTranscriptRef.current
    ) {
      return;
    }

    lastTranscriptRef.current =
      trimmedTranscript;
    setValue(trimmedTranscript);

    void (async () => {
      setSubmissionFeedback("sending");

      try {
        await onSend(trimmedTranscript);
        setValue("");
        clearTranscript();
        lastTranscriptRef.current = "";
        setSubmissionFeedback("success");
        scheduleFeedbackReset();
      } catch {
        setSubmissionFeedback("error");
      }
    })();
  }, [
    clearTranscript,
    isSubmissionBusy,
    onSend,
    scheduleFeedbackReset,
    transcript,
  ]);

  useEffect(() => {
    if (
      !voiceEntryRequested ||
      hasFocusedVoiceEntryRef.current
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const voiceReady =
        captureMode !== "detecting" &&
        !isSubmissionBusy;
      const focusTarget = voiceReady
        ? voiceButtonRef.current
        : voiceEntryHintRef.current;

      focusTarget?.focus({ preventScroll: true });
      focusTarget?.scrollIntoView?.({
        block: "center",
        behavior: window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches
          ? "auto"
          : "smooth",
      });

      if (voiceReady && voiceButtonRef.current) {
        hasFocusedVoiceEntryRef.current = true;
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [captureMode, isSubmissionBusy, voiceEntryRequested]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    void unlockAudio();

    const trimmedValue = value.trim();

    if (!trimmedValue || isSubmissionBusy) {
      return;
    }

    setSubmissionFeedback("sending");

    try {
      await onSend(trimmedValue);
      setValue("");
      setSubmissionFeedback("success");
      scheduleFeedbackReset();
    } catch {
      setSubmissionFeedback("error");
    }
  }

  async function handleAudioFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    clearVoiceError();
    await transcribeAudioFile(file);
    event.target.value = "";
  }

  const placeholder =
    state === "listening"
      ? t("chat.listening")
      : state === "processing"
        ? t("chat.processing")
        : t("chat.placeholder");
  const errorKey =
    getVoiceErrorKey(voiceError);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          role="switch"
          aria-checked={voiceMode}
          data-state={voiceMode ? "active" : "inactive"}
          disabled={isSubmissionBusy}
          aria-label={
            voiceMode
              ? t("chat.voiceOn")
              : t("chat.voiceOff")
          }
          onClick={() => {
            void unlockAudio();
            setVoiceMode(!voiceMode);
          }}
          className={[
            "group inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-full border px-3 py-2",
            "text-xs font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none motion-reduce:transition-none",
            voiceMode
              ? "border-[var(--project-border-strong)] bg-[var(--project-active)] text-[var(--project-text)]"
              : "border-[var(--project-border,var(--vaeora-line))] bg-[var(--project-surface)] text-[var(--project-text-secondary,var(--vaeora-muted))]",
          ].join(" ")}
        >
          <span
            className={[
              "h-2 w-2 rounded-full transition",
              voiceMode
                ? "bg-purple-300 shadow-[0_0_12px_rgba(216,180,254,0.9)]"
                : "bg-zinc-600",
            ].join(" ")}
            aria-hidden="true"
          />
          <span>Aura Prime</span>
          <span className="text-[10px] uppercase tracking-[0.16em] opacity-70">
            {voiceMode
              ? t("chat.voiceOn")
              : t("chat.voiceOff")}
          </span>
          <span
            className={[
              "relative h-5 w-9 rounded-full transition",
              voiceMode
                ? "bg-purple-500"
                : "bg-zinc-700",
            ].join(" ")}
            aria-hidden="true"
          >
            <span
              className={[
                "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                voiceMode
                  ? "translate-x-4"
                  : "translate-x-0",
              ].join(" ")}
            />
          </span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        aria-busy={isSubmissionBusy}
        className="flex gap-3"
      >
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (
              submissionFeedback === "success" ||
              submissionFeedback === "error"
            ) {
              setSubmissionFeedback("idle");
            }
          }}
          placeholder={placeholder}
          aria-label={t("chat.placeholder")}
          autoComplete="off"
          enterKeyHint="send"
          disabled={isSubmissionBusy}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--project-border,var(--vaeora-line))] bg-[var(--project-surface-elevated,var(--vaeora-raised))] px-4 py-3 text-[var(--project-text,var(--vaeora-text))] outline-none transition placeholder:text-[var(--project-placeholder,var(--vaeora-muted))] focus-visible:border-[var(--project-focus,var(--vaeora-focus))] focus-visible:ring-2 focus-visible:ring-[var(--project-accent-soft,rgba(119,100,232,.2))] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none"
        />

        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          onChange={handleAudioFile}
          className="hidden"
          tabIndex={-1}
        />

        <VoiceButton
          buttonRef={voiceButtonRef}
          descriptionId={
            voiceEntryRequested
              ? "iaura-voice-entry-hint"
              : undefined
          }
          state={state}
          captureMode={captureMode}
          onStartListening={startListening}
          onStopListening={stopListening}
          onStopSpeaking={stopSpeaking}
          onRequestAudioFile={() => {
            clearVoiceError();
            audioInputRef.current?.click();
          }}
          disabled={isSubmissionBusy}
        />

        <button
          type="submit"
          disabled={
            !value.trim() || isSubmissionBusy
          }
          aria-busy={isSubmissionBusy}
          data-state={submissionFeedback}
          className="inline-flex min-h-12 min-w-[6.75rem] touch-manipulation items-center justify-center gap-2 rounded-xl bg-[var(--project-action,#9333ea)] px-4 py-3 font-semibold text-[var(--project-action-text,#fff)] transition hover:bg-[var(--project-action-hover,#a855f7)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus,var(--vaeora-focus))] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none"
        >
          {isSubmissionBusy ? (
            <>
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none"
              />
              <span>{t("chat.sending")}</span>
            </>
          ) : (
            t("chat.send")
          )}
        </button>
      </form>

      <div aria-live="polite" className="min-h-5 px-1 text-xs">
        {submissionFeedback === "success" ? (
          <p className="text-emerald-200">
            <span aria-hidden="true">✓ </span>
            {t("chat.sent")}
          </p>
        ) : submissionFeedback === "error" ? (
          <p role="alert" className="text-amber-300">
            <span aria-hidden="true">! </span>
            {t("chat.sendFailed")}
          </p>
        ) : null}
      </div>

      {voiceEntryRequested ? (
        <p
          ref={voiceEntryHintRef}
          id="iaura-voice-entry-hint"
          role="status"
          tabIndex={-1}
          className="rounded-xl border border-violet-300/15 bg-violet-500/[0.06] px-3 py-2 text-xs leading-5 text-violet-100/75 outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
        >
          {t("chat.voiceEntryHint")}
        </p>
      ) : null}

      {errorKey ? (
        <p
          role="alert"
          className="px-1 text-xs text-amber-300"
        >
          {t(errorKey)}
        </p>
      ) : null}
    </div>
  );
}

export const ChatInput = memo(
  ChatInputComponent
);

ChatInput.displayName = "ChatInput";
