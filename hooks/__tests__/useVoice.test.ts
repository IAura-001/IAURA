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
        canRecord: true,
        hasSpeechRecognition: true,
      })
    ).toBe("media-recorder");
  });

  it("uses the native phone recorder on insecure links", () => {
    expect(
      detectVoiceCaptureMode({
        isMobile: true,
        canRecord: false,
        hasSpeechRecognition: true,
      })
    ).toBe("file-upload");
  });

  it("keeps browser recognition on desktop", () => {
    expect(
      detectVoiceCaptureMode({
        isMobile: false,
        canRecord: false,
        hasSpeechRecognition: true,
      })
    ).toBe("speech-recognition");
  });
});
