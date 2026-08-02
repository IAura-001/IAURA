export type VoiceCaptureMode =
  | "detecting"
  | "speech-recognition"
  | "media-recorder"
  | "file-upload"
  | "secure-context-required";

export function detectVoiceCaptureMode({
  isMobile,
  isSecureContext,
  canRecord,
  hasSpeechRecognition,
}: {
  isMobile: boolean;
  isSecureContext: boolean;
  canRecord: boolean;
  hasSpeechRecognition: boolean;
}): Exclude<
  VoiceCaptureMode,
  "detecting"
> {
  if (!isSecureContext) {
    return "secure-context-required";
  }

  if (isMobile) {
    return canRecord
      ? "media-recorder"
      : "file-upload";
  }

  if (hasSpeechRecognition) {
    return "speech-recognition";
  }

  return canRecord
    ? "media-recorder"
    : "file-upload";
}
