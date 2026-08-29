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
import { isAbortError } from "@/utils/abort";

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
  readonly isFinal?: boolean;
}

interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResult;
  readonly length?: number;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex?: number;
}

interface SpeechRecognitionErrorEvent {
  error?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onaudioend: (() => void) | null;
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
  webkitAudioContext?: typeof AudioContext;
}

const MAX_RECORDING_MS = 30_000;
const NO_SPEECH_TIMEOUT_MS = 10_000;
const SILENCE_AFTER_SPEECH_MS = 1_150;
export const HANDS_FREE_END_OF_UTTERANCE_MS = 2_600;
const HANDS_FREE_RESTART_DELAY_MS = 180;
const HANDS_FREE_MAX_RESTART_ATTEMPTS = 3;
const VOICE_ACTIVITY_THRESHOLD = 0.035;
const VOICE_MODE_STORAGE_KEY =
  "iaura.voice.enabled";
const VOICE_MODE_EVENT =
  "iaura:voice-mode-change";

function appendTranscript(current: string, segment: string): string {
  const left = current.trim();
  const right = segment.trim();
  if (!right) return left;
  if (!left) return right;
  if (left === right || left.endsWith(right)) return left;
  if (right.startsWith(left)) return right;
  return `${left} ${right}`.replace(/\s+/g, " ").trim();
}

function traceRecognition(event: string, details?: unknown): void {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[IAURA voice] ${event}`, details ?? "");
  }
}

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
  const discardRecordingRef =
    useRef(false);
  const continuousListeningRef =
    useRef(false);
  const recordingTimerRef =
    useRef<number | null>(null);
  const voiceActivityTimerRef =
    useRef<number | null>(null);
  const audioContextRef =
    useRef<AudioContext | null>(null);
  const audioAnalyserRef =
    useRef<AnalyserNode | null>(null);
  const audioSourceRef =
    useRef<MediaStreamAudioSourceNode | null>(
      null
    );
  const speechOperationRef = useRef(0);
  const listeningOperationRef = useRef(0);
  const transcriptionOperationRef = useRef(0);
  const transcriptionControllerRef = useRef<AbortController | null>(null);
  const recognitionActiveRef = useRef(false);
  const handsFreeFinalTranscriptRef = useRef("");
  const handsFreeInterimTranscriptRef = useRef("");
  const handsFreeSubmissionRef = useRef(false);
  const handsFreeProcessingRef = useRef(false);
  const handsFreeSilenceTimerRef = useRef<number | null>(null);
  const recognitionRestartTimerRef = useRef<number | null>(null);
  const recognitionRestartAttemptsRef = useRef(0);

  const clearHandsFreeTimers = useCallback(() => {
    if (handsFreeSilenceTimerRef.current !== null) {
      window.clearTimeout(handsFreeSilenceTimerRef.current);
      handsFreeSilenceTimerRef.current = null;
    }
    if (recognitionRestartTimerRef.current !== null) {
      window.clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
  }, []);

  const resetHandsFreeUtterance = useCallback(() => {
    clearHandsFreeTimers();
    handsFreeFinalTranscriptRef.current = "";
    handsFreeInterimTranscriptRef.current = "";
    handsFreeSubmissionRef.current = false;
  }, [clearHandsFreeTimers]);

  const releaseVoiceActivity =
    useCallback((keepContext = false) => {
      if (
        voiceActivityTimerRef.current !==
        null
      ) {
        window.clearInterval(
          voiceActivityTimerRef.current
        );
        voiceActivityTimerRef.current = null;
      }

      if (keepContext) {
        return;
      }

      audioSourceRef.current?.disconnect();
      audioSourceRef.current = null;
      audioAnalyserRef.current = null;

      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }, []);

  const releaseRecording = useCallback((
    keepStream = false
  ) => {
    if (recordingTimerRef.current !== null) {
      window.clearTimeout(
        recordingTimerRef.current
      );
      recordingTimerRef.current = null;
    }

    releaseVoiceActivity(keepStream);

    if (!keepStream) {
      streamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
      streamRef.current = null;
    }

    recorderRef.current = null;
    chunksRef.current = [];
  }, [releaseVoiceActivity]);

  const cancelListeningResources = useCallback(() => {
    transcriptionOperationRef.current += 1;
    transcriptionControllerRef.current?.abort();
    transcriptionControllerRef.current = null;
    continuousListeningRef.current = false;
    handsFreeProcessingRef.current = false;
    resetHandsFreeUtterance();

    if (
      recorderRef.current?.state ===
      "recording"
    ) {
      discardRecordingRef.current = true;
      recorderRef.current.stop();
      return;
    }

    recognitionRef.current?.abort();
    releaseRecording(false);
  }, [releaseRecording, resetHandsFreeUtterance]);

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
        speechOperationRef.current += 1;
        listeningOperationRef.current += 1;
        try {
          cancelListeningResources();
        } finally {
          try {
            voiceEngine.stop();
          } finally {
            setState("idle");
          }
        }
      }
    },
    [cancelListeningResources]
  );

  const startVoiceActivityDetection =
    useCallback(
      (
        stream: MediaStream,
        recorder: MediaRecorder
      ) => {
        const voiceWindow =
          window as VoiceWindow;
        const AudioContextConstructor =
          window.AudioContext ??
          voiceWindow.webkitAudioContext;

        if (!AudioContextConstructor) {
          return;
        }

        try {
          releaseVoiceActivity(true);

          let audioContext =
            audioContextRef.current;
          let analyser =
            audioAnalyserRef.current;

          if (
            !audioContext ||
            audioContext.state === "closed" ||
            !analyser
          ) {
            audioContext =
              new AudioContextConstructor();
            analyser =
              audioContext.createAnalyser();
            const source =
              audioContext.createMediaStreamSource(
                stream
              );

            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant =
              0.35;
            source.connect(analyser);

            audioContextRef.current =
              audioContext;
            audioAnalyserRef.current = analyser;
            audioSourceRef.current = source;
          }

          if (
            audioContext.state ===
            "suspended"
          ) {
            void audioContext.resume();
          }

          const samples = new Float32Array(
            analyser.fftSize
          );
          const recordingStartedAt =
            performance.now();
          let heardVoice = false;
          let lastVoiceAt =
            recordingStartedAt;

          voiceActivityTimerRef.current =
            window.setInterval(() => {
              if (
                recorder.state !==
                "recording"
              ) {
                return;
              }

              analyser.getFloatTimeDomainData(
                samples
              );

              let energy = 0;

              for (
                let index = 0;
                index < samples.length;
                index += 1
              ) {
                energy += samples[index] ** 2;
              }

              const level = Math.sqrt(
                energy / samples.length
              );
              const now = performance.now();

              if (
                level >=
                VOICE_ACTIVITY_THRESHOLD
              ) {
                heardVoice = true;
                lastVoiceAt = now;
                return;
              }

              const silenceComplete =
                heardVoice &&
                now - lastVoiceAt >=
                  (continuousListeningRef.current
                    ? HANDS_FREE_END_OF_UTTERANCE_MS
                    : SILENCE_AFTER_SPEECH_MS);
              const noSpeechTimeout =
                !heardVoice &&
                now - recordingStartedAt >=
                  NO_SPEECH_TIMEOUT_MS;

              if (
                silenceComplete ||
                noSpeechTimeout
              ) {
                recorder.stop();
              }
            }, 80);
        } catch (error) {
          console.warn(
            "IAURA voice activity detection unavailable:",
            error
          );
          releaseVoiceActivity(false);
        }
      },
      [releaseVoiceActivity]
    );

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

      const operation = ++transcriptionOperationRef.current;
      transcriptionControllerRef.current?.abort();
      const controller = new AbortController();
      transcriptionControllerRef.current = controller;

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
console.info(
  "IAURA audio prepared:",
  {
    type: audio.type,
    size: audio.size,
    fileName,
    language,
  }
);
        const response = await fetch(
          "/api/transcribe",
          {
            method: "POST",
            body: formData,
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
  const errorBody = (await response
    .json()
    .catch(() => null)) as
    | {
        error?: unknown;
        code?: unknown;
        details?: unknown;
      }
    | null;

  console.error(
    "IAURA transcription response:",
    {
      status: response.status,
      audioType: audio.type,
      audioSize: audio.size,
      fileName,
      response: errorBody,
    }
  );

  throw new Error(
    typeof errorBody?.error === "string"
      ? errorBody.error
      : `Transcription failed: ${response.status}`
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

        if (transcriptionOperationRef.current !== operation) return;
        setTranscript("");
        window.setTimeout(() => {
          if (transcriptionOperationRef.current !== operation) return;
          setTranscript(text);
          setState("idle");
        }, 0);
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        console.error(
          "IAURA transcription failed:",
          error
        );
        setVoiceError(
          "transcription-failed"
        );
        setState("idle");
      } finally {
        if (transcriptionControllerRef.current === controller) {
          transcriptionControllerRef.current = null;
        }
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
        isSecureContext: window.isSecureContext,
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

    function startRecognitionSafely() {
      if (
        recognitionActiveRef.current ||
        !continuousListeningRef.current ||
        handsFreeProcessingRef.current ||
        !getVoiceModeSnapshot()
      ) return;
      try {
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.start();
        traceRecognition("restart requested");
      } catch (error) {
        recognitionActiveRef.current = false;
        setState("idle");
        traceRecognition("restart deferred", error);
        recognitionRestartAttemptsRef.current += 1;
        if (
          recognitionRestartAttemptsRef.current >=
          HANDS_FREE_MAX_RESTART_ATTEMPTS
        ) {
          continuousListeningRef.current = false;
          setVoiceError("transcription-failed");
          return;
        }
        scheduleRecognitionRestart();
      }
    }

    function scheduleRecognitionRestart() {
      if (recognitionRestartTimerRef.current !== null) return;
      recognitionRestartTimerRef.current = window.setTimeout(() => {
        recognitionRestartTimerRef.current = null;
        startRecognitionSafely();
      }, HANDS_FREE_RESTART_DELAY_MS);
    }

    const finishHandsFreeUtterance = () => {
      if (
        !continuousListeningRef.current ||
        handsFreeSubmissionRef.current ||
        handsFreeProcessingRef.current
      ) return;
      const text = appendTranscript(
        handsFreeFinalTranscriptRef.current,
        handsFreeInterimTranscriptRef.current,
      );
      if (!text) return;
      handsFreeSubmissionRef.current = true;
      handsFreeProcessingRef.current = true;
      clearHandsFreeTimers();
      setState("processing");
      setTranscript("");
      if (recognitionActiveRef.current) recognition.abort();
      window.setTimeout(() => setTranscript(text), 0);
    };

    const scheduleEndOfUtterance = () => {
      if (handsFreeSilenceTimerRef.current !== null) {
        window.clearTimeout(handsFreeSilenceTimerRef.current);
      }
      handsFreeSilenceTimerRef.current = window.setTimeout(() => {
        handsFreeSilenceTimerRef.current = null;
        finishHandsFreeUtterance();
      }, HANDS_FREE_END_OF_UTTERANCE_MS);
    };

    recognition.onstart = () => {
      recognitionActiveRef.current = true;
      recognitionRestartAttemptsRef.current = 0;
      traceRecognition("start");
      if (!getVoiceModeSnapshot()) {
        recognition.abort();
        return;
      }

      setVoiceError(null);
      setState("listening");
    };

    recognition.onaudiostart = () => traceRecognition("audio start");
    recognition.onsoundstart = () => traceRecognition("sound start");
    recognition.onspeechstart = () => traceRecognition("speech start");
    recognition.onspeechend = () => traceRecognition("speech end");
    recognition.onaudioend = () => traceRecognition("audio end");

    recognition.onresult = (event) => {
      traceRecognition("result", event.results);
      if (!getVoiceModeSnapshot()) {
        return;
      }

      if (!continuousListeningRef.current) {
        const text = event.results[0]?.[0]?.transcript?.trim();
        if (!text) return;
        setTranscript("");
        setState("processing");
        window.setTimeout(() => setTranscript(text), 0);
        return;
      }

      const previousTranscript = appendTranscript(
        handsFreeFinalTranscriptRef.current,
        handsFreeInterimTranscriptRef.current,
      );
      let interim = "";
      let receivedFinal = false;
      const startIndex = event.resultIndex ?? 0;
      const resultCount = event.results.length ?? (event.results[0] ? 1 : 0);
      for (let index = startIndex; index < resultCount; index += 1) {
        const result = event.results[index];
        const segment = result?.[0]?.transcript?.trim() ?? "";
        if (!segment) continue;
        if (result.isFinal) {
          receivedFinal = true;
          handsFreeFinalTranscriptRef.current = appendTranscript(
            handsFreeFinalTranscriptRef.current,
            segment,
          );
        } else {
          interim = appendTranscript(interim, segment);
        }
      }
      if (interim) {
        handsFreeInterimTranscriptRef.current = interim;
      } else if (receivedFinal) {
        handsFreeInterimTranscriptRef.current = "";
      }
      const nextTranscript = appendTranscript(
        handsFreeFinalTranscriptRef.current,
        handsFreeInterimTranscriptRef.current,
      );
      if (nextTranscript) {
        setState("listening");
        if (nextTranscript !== previousTranscript) {
          scheduleEndOfUtterance();
        }
      }
    };

    recognition.onend = () => {
      recognitionActiveRef.current = false;
      traceRecognition("end");
      if (
        continuousListeningRef.current &&
        !handsFreeProcessingRef.current &&
        handsFreeInterimTranscriptRef.current
      ) {
        handsFreeFinalTranscriptRef.current = appendTranscript(
          handsFreeFinalTranscriptRef.current,
          handsFreeInterimTranscriptRef.current,
        );
        handsFreeInterimTranscriptRef.current = "";
      }
      if (
        continuousListeningRef.current &&
        !handsFreeProcessingRef.current &&
        getVoiceModeSnapshot()
      ) {
        scheduleRecognitionRestart();
        return;
      }
      setState((currentState) =>
        currentState === "listening"
          ? "idle"
          : currentState
      );
    };

    recognition.onerror = (event) => {
      recognitionActiveRef.current = false;
      traceRecognition("error", event.error);
      const permissionError =
        event.error === "not-allowed" ||
        event.error ===
          "service-not-allowed";

      const fatalError = permissionError || event.error === "audio-capture";
      const recoverableError = event.error === "no-speech" || event.error === "aborted" || event.error === "network";
      const hasUsableTranscript = Boolean(appendTranscript(
        handsFreeFinalTranscriptRef.current,
        handsFreeInterimTranscriptRef.current,
      ));
      if (fatalError) {
        continuousListeningRef.current = false;
        resetHandsFreeUtterance();
        setVoiceError(permissionError ? "permission-denied" : "unavailable");
        setState("idle");
        return;
      }
      if (continuousListeningRef.current && hasUsableTranscript) {
        if (handsFreeSilenceTimerRef.current === null) {
          scheduleEndOfUtterance();
        }
        scheduleRecognitionRestart();
        return;
      }
      if (continuousListeningRef.current && recoverableError) {
        scheduleRecognitionRestart();
        return;
      }
      setVoiceError("transcription-failed");
      setState("idle");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onaudiostart = null;
      recognition.onsoundstart = null;
      recognition.onspeechstart = null;
      recognition.onspeechend = null;
      recognition.onaudioend = null;
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognitionActiveRef.current = false;
      clearHandsFreeTimers();
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [captureMode, clearHandsFreeTimers, language, resetHandsFreeUtterance]);

  useEffect(() => {
    return () => {
      transcriptionOperationRef.current += 1;
      transcriptionControllerRef.current?.abort();
      transcriptionControllerRef.current = null;
      speechOperationRef.current += 1;
      voiceEngine.stop();
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
    useCallback(async (operation: number) => {
      if (
        !window.isSecureContext
      ) {
        setCaptureMode("secure-context-required");
        setVoiceError("unavailable");
        setState("idle");
        return;
      }

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
        releaseRecording(true);

        const reusableStream =
          streamRef.current;
        const hasLiveAudioTrack =
          reusableStream?.getAudioTracks().some(
            (track) =>
              track.readyState === "live"
          ) ?? false;
        const stream =
          hasLiveAudioTrack && reusableStream
          ? reusableStream
          : await navigator.mediaDevices.getUserMedia(
              {
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
                video: false,
              }
            );

        if (
          listeningOperationRef.current !== operation ||
          !getVoiceModeSnapshot()
        ) {
          stream
            .getTracks()
            .forEach((track) => track.stop());
          return;
        }

        const mimeType =
          chooseRecordingMimeType();
        const recorder = mimeType
          ? new MediaRecorder(stream, {
              mimeType,
            })
          : new MediaRecorder(stream);

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
          continuousListeningRef.current =
            false;
          setVoiceError(
            "transcription-failed"
          );
          setState("idle");
          releaseRecording();
        };

        recorder.onstop = () => {
          if (discardRecordingRef.current) {
            discardRecordingRef.current =
              false;
            releaseRecording(false);
            setState("idle");
            return;
          }

          const audio = new Blob(
            chunksRef.current,
            {
              type:
                recorder.mimeType ||
                mimeType ||
                "audio/webm",
            }
          );

          releaseRecording(
            continuousListeningRef.current
          );
          void transcribeAudio(audio);
        };

        recorder.start(250);
        discardRecordingRef.current = false;
        startVoiceActivityDetection(
          stream,
          recorder
        );
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
        if (
          listeningOperationRef.current !== operation ||
          !getVoiceModeSnapshot()
        ) {
          return;
        }

        continuousListeningRef.current =
          false;
        const errorName =
          error instanceof DOMException
            ? error.name
            : "UnknownError";
        const isPermissionError =
          errorName === "NotAllowedError" ||
          errorName === "SecurityError";
        const isInterrupted =
          errorName === "AbortError";

        if (process.env.NODE_ENV !== "production") {
          console.warn("IAURA microphone access ended:", {
            name: errorName,
            intentional: isInterrupted,
          });
        }
        setVoiceError(
          isPermissionError
            ? "permission-denied"
            : "unavailable"
        );
        setState("idle");
        releaseRecording(false);
      }
    }, [
      releaseRecording,
      setVoiceMode,
      startVoiceActivityDetection,
      transcribeAudio,
    ]);

  const startListening = useCallback(
    async () => {
      const operation =
        ++listeningOperationRef.current;
      void voiceEngine.unlock();
      setVoiceError(null);
      setVoiceMode(true);

      if (
        captureMode ===
        "secure-context-required"
      ) {
        setVoiceError("unavailable");
        setState("idle");
        return;
      }

      if (
        captureMode ===
        "media-recorder"
      ) {
        await startMediaRecording(operation);
        return;
      }

      if (
        captureMode ===
          "speech-recognition" &&
        recognitionRef.current
      ) {
        try {
          if (continuousListeningRef.current) {
            handsFreeProcessingRef.current = false;
            resetHandsFreeUtterance();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
          } else {
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
          }
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
      resetHandsFreeUtterance,
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

    transcriptionOperationRef.current += 1;
    transcriptionControllerRef.current?.abort();
    transcriptionControllerRef.current = null;
    recognitionRef.current?.stop();
  }, []);

  const startContinuousListening =
    useCallback(async () => {
      continuousListeningRef.current = true;
      await startListening();
    }, [startListening]);

  const stopContinuousListening =
    useCallback(() => {
      transcriptionOperationRef.current += 1;
      transcriptionControllerRef.current?.abort();
      transcriptionControllerRef.current = null;
      continuousListeningRef.current = false;
      handsFreeProcessingRef.current = false;
      resetHandsFreeUtterance();

      if (
        recorderRef.current?.state ===
        "recording"
      ) {
        discardRecordingRef.current = true;
        recorderRef.current.stop();
        return;
      }

      recognitionRef.current?.abort();
      releaseRecording(false);
      setState("idle");
    }, [releaseRecording, resetHandsFreeUtterance]);

  const cancelListening = useCallback(() => {
    transcriptionOperationRef.current += 1;
    transcriptionControllerRef.current?.abort();
    transcriptionControllerRef.current = null;
    continuousListeningRef.current = false;
    handsFreeProcessingRef.current = false;
    resetHandsFreeUtterance();

    if (
      recorderRef.current?.state ===
      "recording"
    ) {
      discardRecordingRef.current = true;
      recorderRef.current.stop();
      return;
    }

    recognitionRef.current?.abort();
    releaseRecording(false);
    setState("idle");
  }, [releaseRecording, resetHandsFreeUtterance]);

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

    const operation = ++speechOperationRef.current;
    setState("speaking");

    try {
      await voiceEngine.speak(
        voiceText,
        "companion",
        language
      );
    } finally {
      if (speechOperationRef.current === operation) {
        setState("idle");
      }
    }
  }

  const stopSpeaking = useCallback(() => {
    speechOperationRef.current += 1;
    voiceEngine.stop();
    setState("idle");
  }, []);

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
    startContinuousListening,
    stopListening,
    stopContinuousListening,
    cancelListening,
    transcribeAudioFile,
    clearTranscript,
    clearVoiceError,
    unlockAudio,
    speak,
    stopSpeaking,
  };
}
