"use client";

import { useI18n } from "@/core/i18n/I18nContext";
import type {
  VoiceCaptureMode,
  VoiceState,
} from "@/hooks/useVoice";

interface VoiceButtonProps {
  state: VoiceState;
  captureMode: VoiceCaptureMode;
  onStartListening: () => void | Promise<void>;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  onRequestAudioFile: () => void;
  disabled?: boolean;
}

export default function VoiceButton({
  state,
  captureMode,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  onRequestAudioFile,
  disabled = false,
}: VoiceButtonProps) {
  const { t } = useI18n();
  const isListening =
    state === "listening";
  const isProcessing =
    state === "processing";
  const isSpeaking =
    state === "speaking";
  const usesNativeRecorder =
    captureMode === "file-upload";

  function handleClick() {
    if (
      disabled ||
      captureMode === "detecting"
    ) {
      return;
    }

    if (isListening) {
      onStopListening();
      return;
    }

    if (isSpeaking) {
      onStopSpeaking();
      return;
    }

    if (usesNativeRecorder) {
      onRequestAudioFile();
      return;
    }

    void onStartListening();
  }

  const label = isListening
    ? t("chat.micStop")
    : isSpeaking
      ? t("chat.voiceStop")
      : usesNativeRecorder
        ? t("chat.recordAudio")
        : t("chat.micStart");

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={
        disabled ||
        isProcessing ||
        captureMode === "detecting"
      }
      aria-label={label}
      title={label}
      className={[
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
        "border border-white/10 text-white transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
        disabled ||
        isProcessing ||
        captureMode === "detecting"
          ? "cursor-not-allowed opacity-40"
          : "hover:border-purple-400/50 hover:bg-purple-500/10",
        isListening
          ? "animate-pulse bg-red-500/20 text-red-300"
          : "",
        isSpeaking
          ? "bg-purple-500/20 text-purple-300"
          : "",
        isProcessing
          ? "bg-cyan-500/15 text-cyan-200"
          : "",
      ].join(" ")}
    >
      {isListening || isSpeaking ? (
        <span
          className="h-3.5 w-3.5 rounded-sm bg-current"
          aria-hidden="true"
        />
      ) : isProcessing ? (
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <path d="M12 19v3" />
          <path d="M8 22h8" />
        </svg>
      )}
    </button>
  );
}
