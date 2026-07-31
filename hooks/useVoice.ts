"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { voiceEngine } from "@/core/voice/voiceEngine";
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  type SupportedLocale,
} from "@/core/i18n/languages";

export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking";

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult:
    | ((event: SpeechRecognitionEvent) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionInstance;

interface VoiceWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export function useVoice() {
  const [state, setState] =
    useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [language, setLanguageState] =
    useState<SupportedLocale>(DEFAULT_LOCALE);

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const voiceWindow = window as VoiceWindow;

    const SpeechRecognition =
      voiceWindow.SpeechRecognition ??
      voiceWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();

    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setState("listening");
    };

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript;

      if (!text) return;

      setTranscript(text);
      setState("processing");
    };

    recognition.onend = () => {
      setState("idle");
    };

    recognition.onerror = () => {
      setState("idle");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [language]);

  const setLanguage = useCallback(
    (nextLanguage: SupportedLocale) => {
      setLanguageState(
        normalizeLocale(nextLanguage)
      );
    },
    []
  );

  function startListening() {
    console.log("VOICE ACTIVATED");
    setVoiceMode(true);
    recognitionRef.current?.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setVoiceMode(false);
  }

  async function speak(text: string) {
    const voiceText = text
      .replaceAll("I.A.U.R.A", "Aura")
      .replaceAll("IAURA", "Aura");

    setState("speaking");

    try {
      await voiceEngine.speak(
        voiceText,
        "companion",
        language
      );
    } finally {
      setState("idle");
    }
  }

  function stopSpeaking() {
    voiceEngine.stop();
    setState("idle");
  }

  return {
    state,
    transcript,
    voiceMode,
    language,
    setLanguage,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
