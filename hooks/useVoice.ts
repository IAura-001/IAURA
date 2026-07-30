"use client";

import { useEffect, useRef, useState } from "react";

export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking";

export function useVoice() {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();

    recognition.lang = "es-ES";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setState("listening");
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;

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
  }, []);

  function startListening() {
  console.log("VOICE ACTIVATED");
  setVoiceMode(true);
  recognitionRef.current?.start();
}

  function stopListening() {
    recognitionRef.current?.stop();
    setVoiceMode(false);
  }

  function speak(text: string) {
    if (typeof window === "undefined") return;

    // Aura solo habla si el modo voz está activo
    

    const voiceText = text
      .replaceAll("IAURA", "Aura")
      .replaceAll("I.A.U.R.A", "Aura");

    const utterance = new SpeechSynthesisUtterance(voiceText);

    utterance.lang = "es-ES";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();

    const spanishVoice = voices.find((voice) =>
      voice.lang.startsWith("es")
    );

    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    utterance.onstart = () => setState("speaking");
    utterance.onend = () => setState("idle");

    speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    speechSynthesis.cancel();
    setState("idle");
  }

  return {
    state,
    transcript,
    voiceMode,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}