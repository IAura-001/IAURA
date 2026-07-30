"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import VoiceButton from "@/components/sections/VoiceButton";
import { useVoiceContext } from "@/core/context/VoiceContext";

interface ChatInputProps {
  onSend: (message?: string) => void | Promise<void>;
  isSending?: boolean;

  // Compatibilidad temporal con AssistantCard.
  value?: string;
  onChange?: (value: string) => void;
}

function ChatInputComponent({
  onSend,
  isSending = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");

  const lastTranscriptRef = useRef("");

  const {
  state,
  transcript,
  startListening,
  stopListening,
  stopSpeaking,
} = useVoiceContext();
  useEffect(() => {
    const trimmedTranscript = transcript.trim();

    if (
      !trimmedTranscript ||
      isSending ||
      trimmedTranscript === lastTranscriptRef.current
    ) {
      return;
    }

    lastTranscriptRef.current = trimmedTranscript;
    setValue(trimmedTranscript);

    void (async () => {
  await onSend(trimmedTranscript);
  setValue("");
})();
  }, [transcript, isSending, onSend]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedValue = value.trim();

    if (!trimmedValue || isSending) return;

    await onSend(trimmedValue);
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-3"
    >
      <input
        value={value}
        onChange={(event) =>
          setValue(event.target.value)
        }
        placeholder={
          state === "listening"
            ? "Escuchando..."
            : "Ask IAURA anything..."
        }
        autoComplete="off"
        enterKeyHint="send"
        disabled={isSending}
        className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3"
      />

      <VoiceButton
        state={state}
        onStartListening={startListening}
        onStopListening={stopListening}
        onStopSpeaking={stopSpeaking}
        disabled={isSending}
      />

      <button
        type="submit"
        disabled={!value.trim() || isSending}
        className="rounded-xl bg-purple-600 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSending ? "..." : "Send"}
      </button>
    </form>
  );
}

export const ChatInput = memo(ChatInputComponent);

ChatInput.displayName = "ChatInput";