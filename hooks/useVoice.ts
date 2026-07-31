"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { voiceEngine } from "@/core/voice/voiceEngine";
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  type SupportedLocale,
} from "@/core/i18n/languages";
import {
  detectVoiceCaptureMode,
  type VoiceCaptureMode,
} from "@/core/voice/captureMode";

export type { VoiceCaptureMode } from "@/core/voice/captureMode";

export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking";

export type VoiceError =
  | "permission-denied"
  | "unavailable"
  | "transcription-failed"
  | null;

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

interface SpeechRecognitionErrorEvent {
  error?: string;
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
  onerror:
    | ((event: SpeechRecognitionErrorEvent) => void)
    | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionInstance;

interface VoiceWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

const MAX_RECORDING_MS = 30_000;
const VOICE_MODE_STORAGE_KEY =
  "iaura.voice.enabled";
const VOICE_MODE_EVENT =
  "iaura:voice-mode-change";

function getVoiceModeSnapshot(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    return (
      window.localStorage.getItem(
        VOICE_MODE_STORAGE_KEY
      ) !== "false"
    );
  } catch {
    return true;
  }
}

function getVoiceModeServerSnapshot(): boolean {
  return true;
}

function subscribeToVoiceMode(
  onStoreChange: () => void
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (
    event: StorageEvent
  ) => {
    if (
      event.key === null ||
      event.key === VOICE_MODE_STORAGE_KEY
    ) {
      onStoreChange();
    }
  };

  window.addEventListener(
    "storage",
    handleStorage
  );
  window.addEventListener(
    VOICE_MODE_EVENT,
    onStoreChange
  );

  return () => {
    window.removeEventListener(
      "storage",
      handleStorage
    );
    window.removeEventListener(
      VOICE_MODE_EVENT,
      onStoreChange
    );
  };
}

function chooseRecordingMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  return (
    [
      "audio/webm;codecs=opus",
      "audio/mp4",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ].find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType)
    ) ?? ""
  );
}

function getAudioFileName(type: string): string {
  if (type.includes("mp4")) {
    return "iaura-voice.mp4";
  }

  if (type.includes("ogg")) {
    return "iaura-voice.ogg";
  }

  return "iaura-voice.webm";
}

export function useVoice() {
  const [state, setState] =
    useState<VoiceState>("idle");
  const [transcript, setTranscript] =
    useState("");
  const voiceMode = useSyncExternalStore(
    subscribeToVoiceMode,
    getVoiceModeSnapshot,
    getVoiceModeServerSnapshot
  );
  const [language, setLanguageState] =
    useState<SupportedLocale>(
      DEFAULT_LOCALE
    );
  const [captureMode, setCaptureMode] =
    useState<VoiceCaptureMode>(
      "detecting"
    );
  const [voiceError, setVoiceError] =
    useState<VoiceError>(null);

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(
      null
    );
  const recorderRef =
    useRef<MediaRecorder | null>(null);
  const streamRef =
    useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef =
    useRef<number | null>(null);

  const setVoiceMode = useCallback(
    (enabled: boolean) => {
      if (typeof window === "undefined") {
        return;
      }

      try {
        window.localStorage.setItem(
          VOICE_MODE_STORAGE_KEY,
          String(enabled)
        );
      } catch {
        // Voice still works when storage is unavailable.
      }

      window.dispatchEvent(
        new Event(VOICE_MODE_EVENT)
      );

      if (enabled) {
        void voiceEngine.unlock();
      } else {
        voiceEngine.stop();
        setState("idle");
      }
    },
    []
  );

  const releaseRecording = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearTimeout(
        recordingTimerRef.current
      );
      recordingTimerRef.current = null;
    }

    streamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const transcribeAudio = useCallback(
    async (
      audio: Blob,
      fileName = getAudioFileName(
        audio.type
      )
    ) => {
      if (audio.size === 0) {
        setVoiceError(
          "transcription-failed"
        );
        setState("idle");
        return;
      }

      setVoiceError(null);
      setState("processing");
      setVoiceMode(true);

      try {
        const formData = new FormData();
        formData.append(
          "audio",
          audio,
          fileName
        );
        formData.append(
          "language",
          language
        );

        const response = await fetch(
          "/api/transcribe",
          {
            method: "POST",
            body: formData,
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Transcription failed: ${response.status}`
          );
        }

        const result =
          (await response.json()) as {
            text?: unknown;
          };
        const text =
          typeof result.text === "string"
            ? result.text.trim()
            : "";

        if (!text) {
          throw new Error(
            "Transcription was empty."
          );
        }

        setTranscript("");
        window.setTimeout(() => {
          setTranscript(text);
          setState("idle");
        }, 0);
      } catch (error) {
        console.error(
          "IAURA transcription failed:",
          error
        );
        setVoiceError(
          "transcription-failed"
        );
        setState("idle");
      }
    },
    [language, setVoiceMode]
  );

  useEffect(() => {
    const voiceWindow =
      window as VoiceWindow;
    const SpeechRecognition =
      voiceWindow.SpeechRecognition ??
      voiceWindow.webkitSpeechRecognition;
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(
        navigator.userAgent
      ) || navigator.maxTouchPoints > 1;
    const canRecord =
      window.isSecureContext &&
      typeof MediaRecorder !==
        "undefined" &&
      Boolean(
        navigator.mediaDevices
          ?.getUserMedia
      );

    const detectedMode =
      detectVoiceCaptureMode({
        isMobile,
        canRecord,
        hasSpeechRecognition:
          Boolean(SpeechRecognition),
      });
    const detectionTimer =
      window.setTimeout(() => {
        setCaptureMode(detectedMode);
      }, 0);

    return () => {
      window.clearTimeout(detectionTimer);
    };
  }, []);

  useEffect(() => {
    if (
      captureMode !==
      "speech-recognition"
    ) {
      return;
    }

    const voiceWindow =
      window as VoiceWindow;
    const SpeechRecognition =
      voiceWindow.SpeechRecognition ??
      voiceWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setVoiceError(null);
      setState("listening");
    };

    recognition.onresult = (event) => {
      const text =
        event.results[0]?.[0]?.transcript
          ?.trim();

      if (!text) return;

      setTranscript("");
      setState("processing");
      window.setTimeout(() => {
        setTranscript(text);
      }, 0);
    };

    recognition.onend = () => {
      setState((currentState) =>
        currentState === "listening"
          ? "idle"
          : currentState
      );
    };

    recognition.onerror = (event) => {
      const permissionError =
        event.error === "not-allowed" ||
        event.error ===
          "service-not-allowed";

      setVoiceError(
        permissionError
          ? "permission-denied"
          : "transcription-failed"
      );
      setState("idle");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [captureMode, language]);

  useEffect(() => {
    return () => {
      releaseRecording();
    };
  }, [releaseRecording]);

  const setLanguage = useCallback(
    (nextLanguage: SupportedLocale) => {
      setLanguageState(
        normalizeLocale(nextLanguage)
      );
    },
    []
  );

  const startMediaRecording =
    useCallback(async () => {
      if (
        !navigator.mediaDevices
          ?.getUserMedia ||
        typeof MediaRecorder ===
          "undefined"
      ) {
        setCaptureMode("file-upload");
        setVoiceError("unavailable");
        return;
      }

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            }
          );
        const mimeType =
          chooseRecordingMimeType();
        const recorder = mimeType
          ? new MediaRecorder(stream, {
              mimeType,
            })
          : new MediaRecorder(stream);

        releaseRecording();
        streamRef.current = stream;
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (
          event
        ) => {
          if (event.data.size > 0) {
            chunksRef.current.push(
              event.data
            );
          }
        };

        recorder.onerror = () => {
          setVoiceError(
            "transcription-failed"
          );
          setState("idle");
          releaseRecording();
        };

        recorder.onstop = () => {
          const audio = new Blob(
            chunksRef.current,
            {
              type:
                recorder.mimeType ||
                mimeType ||
                "audio/webm",
            }
          );

          releaseRecording();
          void transcribeAudio(audio);
        };

        recorder.start(250);
        setVoiceError(null);
        setVoiceMode(true);
        setState("listening");

        recordingTimerRef.current =
          window.setTimeout(() => {
            if (
              recorder.state ===
              "recording"
            ) {
              recorder.stop();
            }
          }, MAX_RECORDING_MS);
      } catch (error) {
        console.error(
          "IAURA microphone access failed:",
          error
        );
        setVoiceError(
          "permission-denied"
        );
        setState("idle");
        releaseRecording();
      }
    }, [
      releaseRecording,
      setVoiceMode,
      transcribeAudio,
    ]);

  const startListening = useCallback(
    async () => {
      void voiceEngine.unlock();
      setVoiceError(null);
      setVoiceMode(true);

      if (
        captureMode ===
        "media-recorder"
      ) {
        await startMediaRecording();
        return;
      }

      if (
        captureMode ===
          "speech-recognition" &&
        recognitionRef.current
      ) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error(
            "IAURA speech recognition failed:",
            error
          );
          setVoiceError(
            "transcription-failed"
          );
          setState("idle");
        }
        return;
      }

      setVoiceError("unavailable");
    },
    [
      captureMode,
      setVoiceMode,
      startMediaRecording,
    ]
  );

  const stopListening = useCallback(() => {
    if (
      recorderRef.current?.state ===
      "recording"
    ) {
      recorderRef.current.stop();
      return;
    }

    recognitionRef.current?.stop();
  }, []);

  const transcribeAudioFile = useCallback(
    async (file: File) => {
      await transcribeAudio(file, file.name);
    },
    [transcribeAudio]
  );

  const clearTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  const clearVoiceError = useCallback(() => {
    setVoiceError(null);
  }, []);

  const unlockAudio = useCallback(() => {
    return voiceEngine.unlock();
  }, []);

  async function speak(text: string) {
    if (!getVoiceModeSnapshot()) {
      return;
    }

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
    setVoiceMode,
    language,
    captureMode,
    voiceError,
    setLanguage,
    startListening,
    stopListening,
    transcribeAudioFile,
    clearTranscript,
    clearVoiceError,
    unlockAudio,
    speak,
    stopSpeaking,
  };
}
