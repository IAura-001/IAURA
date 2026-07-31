"use client";

import {
  memo,
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
}

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
}: ChatInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const lastTranscriptRef = useRef("");
  const audioInputRef =
    useRef<HTMLInputElement>(null);

  const {
    state,
    transcript,
    captureMode,
    voiceError,
    startListening,
    stopListening,
    stopSpeaking,
    transcribeAudioFile,
    clearTranscript,
    clearVoiceError,
  } = useVoiceContext();

  useEffect(() => {
    const trimmedTranscript =
      transcript.trim();

    if (
      !trimmedTranscript ||
      isSending ||
      trimmedTranscript ===
        lastTranscriptRef.current
    ) {
      return;
    }

    lastTranscriptRef.current =
      trimmedTranscript;
    setValue(trimmedTranscript);

    void (async () => {
      await onSend(trimmedTranscript);
      setValue("");
      clearTranscript();
      lastTranscriptRef.current = "";
    })();
  }, [
    clearTranscript,
    isSending,
    onSend,
    transcript,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedValue = value.trim();

    if (!trimmedValue || isSending) {
      return;
    }

    await onSend(trimmedValue);
    setValue("");
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
      <form
        onSubmit={handleSubmit}
        className="flex gap-3"
      >
        <input
          value={value}
          onChange={(event) =>
            setValue(event.target.value)
          }
          placeholder={placeholder}
          aria-label={t("chat.placeholder")}
          autoComplete="off"
          enterKeyHint="send"
          disabled={isSending}
          className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none transition focus:border-purple-400/70 focus:ring-2 focus:ring-purple-500/20"
        />

        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          capture
          onChange={handleAudioFile}
          className="hidden"
          tabIndex={-1}
        />

        <VoiceButton
          state={state}
          captureMode={captureMode}
          onStartListening={startListening}
          onStopListening={stopListening}
          onStopSpeaking={stopSpeaking}
          onRequestAudioFile={() => {
            clearVoiceError();
            audioInputRef.current?.click();
          }}
          disabled={isSending}
        />

        <button
          type="submit"
          disabled={
            !value.trim() || isSending
          }
          className="rounded-xl bg-purple-600 px-5 py-3 font-semibold transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? "…" : t("chat.send")}
        </button>
      </form>

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
