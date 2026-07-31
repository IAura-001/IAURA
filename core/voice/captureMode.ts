export type VoiceCaptureMode =
  | "detecting"
  | "speech-recognition"
  | "media-recorder"
  | "file-upload";

export function detectVoiceCaptureMode({
  isMobile,
  canRecord,
  hasSpeechRecognition,
}: {
  isMobile: boolean;
  canRecord: boolean;
  hasSpeechRecognition: boolean;
}): Exclude<
  VoiceCaptureMode,
  "detecting"
> {
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
