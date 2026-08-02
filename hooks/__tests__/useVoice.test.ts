import {
  describe,
  expect,
  it,
} from "vitest";

import { detectVoiceCaptureMode } from "../../core/voice/captureMode";

describe("IAURA voice capture selection", () => {
  it("uses reliable recording on secure phones", () => {
    expect(
      detectVoiceCaptureMode({
        isMobile: true,
        isSecureContext: true,
        canRecord: true,
        hasSpeechRecognition: true,
      })
    ).toBe("media-recorder");
  });

  it("never opens a native media picker on insecure links", () => {
    expect(
      detectVoiceCaptureMode({
        isMobile: true,
        isSecureContext: false,
        canRecord: false,
        hasSpeechRecognition: true,
      })
    ).toBe("secure-context-required");
  });

  it("keeps browser recognition on desktop", () => {
    expect(
      detectVoiceCaptureMode({
        isMobile: false,
        isSecureContext: true,
        canRecord: false,
        hasSpeechRecognition: true,
      })
    ).toBe("speech-recognition");
  });
});
