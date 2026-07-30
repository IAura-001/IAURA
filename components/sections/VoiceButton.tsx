"use client";

import type { VoiceState } from "@/hooks/useVoice";

interface VoiceButtonProps {
  state: VoiceState;
  onStartListening: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  disabled?: boolean;
}

export default function VoiceButton({
  state,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  disabled = false,
}: VoiceButtonProps) {
  const isListening = state === "listening";
  const isSpeaking = state === "speaking";

  function handleClick() {
    if (disabled) return;

    if (isListening) {
      onStopListening();
      return;
    }

    if (isSpeaking) {
      onStopSpeaking();
      return;
    }

    onStartListening();
  }

  const label = isListening
    ? "Detener micrófono"
    : isSpeaking
      ? "Detener voz"
      : "Hablar con IAURA";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
        "border border-white/10 text-white transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "hover:border-purple-400/50 hover:bg-purple-500/10",
        isListening
          ? "animate-pulse bg-red-500/20 text-red-300"
          : "",
        isSpeaking
          ? "bg-purple-500/20 text-purple-300"
          : "",
      ].join(" ")}
    >
      {isListening || isSpeaking ? (
        <span className="text-lg font-bold">■</span>
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