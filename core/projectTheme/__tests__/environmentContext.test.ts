import { describe, expect, it } from "vitest";
import { PROJECT_THEME_PRESETS, resolveMotionSignature } from "../themeDNA";
import { projectEnvironmentContext, resolveAdaptiveEnvironment } from "../environmentContext";

describe("living project environment context", () => {
  it("projects real voice and workspace signals with deterministic priority", () => {
    expect(projectEnvironmentContext({ activeView: "projects", voiceState: "listening", isSending: true })).toBe("listening");
    expect(projectEnvironmentContext({ activeView: "presence", voiceState: "idle", isSending: true })).toBe("processing");
    expect(projectEnvironmentContext({ activeView: "projects", voiceState: "idle", isSending: false })).toBe("creating");
    expect(projectEnvironmentContext({ activeView: "intelligence", voiceState: "idle", isSending: false })).toBe("reviewing");
  });

  it("never changes Theme DNA while context changes", () => {
    const dna = structuredClone(PROJECT_THEME_PRESETS.wellness);
    const before = structuredClone(dna);
    const motion = resolveMotionSignature("same", dna);
    expect(resolveAdaptiveEnvironment(dna, motion, "idle")).not.toEqual(resolveAdaptiveEnvironment(dna, motion, "processing"));
    expect(dna).toEqual(before);
  });

  it("lets Motion DNA change how the same context responds without industry coupling", () => {
    const calm = PROJECT_THEME_PRESETS.wellness;
    const dynamic = { ...calm, motionStyle: "dynamic" as const, presetId: "unrelated", userLabel: "Anything" };
    expect(resolveAdaptiveEnvironment(calm, resolveMotionSignature("p", calm), "processing"))
      .not.toEqual(resolveAdaptiveEnvironment(dynamic, resolveMotionSignature("p", dynamic), "processing"));
  });

  it("keeps temporary state lower priority than current real activity", () => {
    expect(projectEnvironmentContext({ activeView: "presence", voiceState: "speaking", isSending: false, temporaryState: "completed" })).toBe("speaking");
  });
});
