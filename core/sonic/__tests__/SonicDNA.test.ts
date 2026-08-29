import { beforeEach, describe, expect, it, vi } from "vitest";
import { interfaceSoundsEnabled, resolveAuditionProfile, resolveIauraProfile, resolvePresenceFusionProfile, resolveSonicProfile, setInterfaceSoundsEnabled, SONIC_OWNERSHIP, sonicEngine } from "../SonicDNA";
import { PROJECT_THEME_PRESETS } from "@/core/projectTheme/themeDNA";

const start = vi.fn();
const stop = vi.fn();
const oscillator = () => ({ type: "sine", frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, detune: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start, stop, onended: null as null | (() => void) });
const gain = () => ({ gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() });
const filter = () => ({ type: "lowpass", frequency: { value: 0 }, Q: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() });
const audioContext = vi.fn(function AudioContextMock() {
  return { state: "running", currentTime: 1, destination: {}, resume: vi.fn(), createGain: gain, createOscillator: oscillator, createBiquadFilter: filter };
});

describe("VAEORA Sonic DNA", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    sonicEngine.resetForTests();
    Object.defineProperty(window, "AudioContext", { configurable: true, value: audioContext });
  });

  it("lazily creates and reuses one AudioContext for semantic playback", () => {
    expect(audioContext).not.toHaveBeenCalled();
    expect(sonicEngine.play("navigation")).toBe(true);
    expect(sonicEngine.play("confirm")).toBe(true);
    expect(audioContext).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(8);
  });

  it("creates and resumes a suspended AudioContext synchronously from first semantic playback", () => {
    const resume = vi.fn(() => Promise.resolve());
    audioContext.mockImplementationOnce(function SuspendedAudioContextMock() {
      return { state: "suspended", currentTime: 1, destination: {}, resume, createGain: gain, createOscillator: oscillator, createBiquadFilter: filter };
    });
    expect(sonicEngine.play("open")).toBe(true);
    expect(audioContext).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalled();
  });

  it("is silent when disabled or voice is active", () => {
    setInterfaceSoundsEnabled(false);
    expect(interfaceSoundsEnabled()).toBe(false);
    expect(sonicEngine.play("tap")).toBe(false);
    expect(sonicEngine.playAudition("deep", "tap")).toBe(false);
    setInterfaceSoundsEnabled(true);
    sonicEngine.setVoiceActive(true);
    expect(sonicEngine.play("completion")).toBe(false);
    expect(sonicEngine.playAudition("hybrid", "completion")).toBe(false);
    expect(audioContext).not.toHaveBeenCalled();
  });

  it("falls back safely without Web Audio", () => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined });
    expect(sonicEngine.play("open")).toBe(false);
    expect(sonicEngine.playAudition("crystalline", "open")).toBe(false);
  });

  it("modulates deterministically by Motion DNA while preserving one canonical family", () => {
    expect(resolveSonicProfile("open", PROJECT_THEME_PRESETS.wellness)).toEqual(resolveSonicProfile("open", PROJECT_THEME_PRESETS.wellness));
    expect(resolveSonicProfile("open", PROJECT_THEME_PRESETS.autoSales).duration).not.toBe(resolveSonicProfile("open", PROJECT_THEME_PRESETS.wellness).duration);
    expect(resolveSonicProfile("tap").root).toBe(244);
    expect(resolveSonicProfile("tap", PROJECT_THEME_PRESETS.autoSales).root).toBe(244);
  });

  it("keeps every semantic role inside its safe duration and gain bounds", () => {
    const roles = ["tap", "navigation", "select", "open", "close", "confirm", "apply", "cancel", "completion", "attention"] as const;
    for (const role of roles) {
      for (const theme of Object.values(PROJECT_THEME_PRESETS)) {
        const profile = resolveSonicProfile(role, theme);
        expect(profile.duration).toBeGreaterThanOrEqual(role === "completion" ? 0.17 : role === "confirm" || role === "apply" ? 0.14 : role === "open" ? 0.1 : role === "tap" ? 0.04 : 0.045);
        expect(profile.duration).toBeLessThanOrEqual(0.28);
        expect(profile.gain).toBeLessThanOrEqual(0.032);
        expect(profile.brightness).toBeLessThanOrEqual(0.17);
      }
    }
  });

  it("drops only rapid repeated low-priority sounds and preserves Apply", () => {
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValueOnce(100).mockReturnValueOnce(110).mockReturnValueOnce(111);
    expect(sonicEngine.play("tap")).toBe(true);
    expect(sonicEngine.play("tap")).toBe(false);
    expect(sonicEngine.play("apply")).toBe(true);
    expect(start).toHaveBeenCalledTimes(8);
    clock.mockRestore();
  });

  it("defines deterministic and perceptually distinct A/B/C candidates", () => {
    const deep = resolveAuditionProfile("deep", "completion", PROJECT_THEME_PRESETS.wellness);
    const crystalline = resolveAuditionProfile("crystalline", "completion", PROJECT_THEME_PRESETS.wellness);
    const hybrid = resolveAuditionProfile("hybrid", "completion", PROJECT_THEME_PRESETS.wellness);
    expect(resolveAuditionProfile("deep", "completion", PROJECT_THEME_PRESETS.wellness)).toEqual(deep);
    expect(new Set([deep.bodyType, crystalline.bodyType, hybrid.bodyType]).size).toBeGreaterThan(1);
    expect(deep.filterType).not.toBe(crystalline.filterType);
    expect(deep.resonanceRatio).not.toBe(crystalline.resonanceRatio);
    expect(crystalline.airRatio).toBeGreaterThan(hybrid.airRatio);
    expect(hybrid.root).toBeGreaterThan(deep.root);
    for (const profile of [deep, crystalline, hybrid]) {
      expect(profile.duration).toBeLessThanOrEqual(0.29);
      expect(profile.gain).toBeLessThanOrEqual(0.028);
    }
  });

  it("keeps the production signature unchanged while audition reuses its AudioContext", () => {
    expect(resolveSonicProfile("tap")).toMatchObject({ root: 244, interval: 1.08, transientMix: expect.any(Number) });
    expect(sonicEngine.playAudition("deep", "tap")).toBe(true);
    expect(sonicEngine.playAudition("crystalline", "tap")).toBe(true);
    expect(sonicEngine.playAudition("hybrid", "tap")).toBe(true);
    expect(audioContext).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(12);
  });

  it("modulates every candidate across all Motion DNA values without changing candidate identity", () => {
    for (const candidate of ["deep", "crystalline", "hybrid"] as const) {
      const profiles = (["calm", "fluid", "dynamic", "precision"] as const).map((motionStyle) =>
        resolveAuditionProfile(candidate, "apply", { ...PROJECT_THEME_PRESETS.wellness, motionStyle }),
      );
      expect(new Set(profiles.map((profile) => profile.duration)).size).toBeGreaterThan(1);
      expect(new Set(profiles.map((profile) => profile.bodyType))).toEqual(new Set([profiles[0].bodyType]));
      expect(profiles.every((profile) => profile.gain <= 0.028)).toBe(true);
    }
  });

  it("protects repeated candidate taps without blocking immediate A/B/C comparison", () => {
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValueOnce(100).mockReturnValueOnce(110).mockReturnValueOnce(111).mockReturnValueOnce(112);
    expect(sonicEngine.playAudition("deep", "tap")).toBe(true);
    expect(sonicEngine.playAudition("deep", "tap")).toBe(false);
    expect(sonicEngine.playAudition("crystalline", "tap")).toBe(true);
    expect(sonicEngine.playAudition("hybrid", "tap")).toBe(true);
    expect(audioContext).toHaveBeenCalledTimes(1);
    clock.mockRestore();
  });

  it("defines deterministic related-but-distinct VAEORA, IAURA and Presence identities", () => {
    const iaura = resolveIauraProfile("activation", PROJECT_THEME_PRESETS.wellness);
    const fusion = resolvePresenceFusionProfile(PROJECT_THEME_PRESETS.wellness);
    expect(resolveIauraProfile("activation", PROJECT_THEME_PRESETS.wellness)).toEqual(iaura);
    expect(resolvePresenceFusionProfile(PROJECT_THEME_PRESETS.wellness)).toEqual(fusion);
    expect(iaura.root).toBeGreaterThan(resolveSonicProfile("open", PROJECT_THEME_PRESETS.wellness).root);
    expect(fusion.vaeoraRoot).toBeLessThan(fusion.iauraRoot);
    expect(fusion.duration).toBeGreaterThanOrEqual(0.22);
    expect(fusion.duration).toBeLessThanOrEqual(0.39);
    expect(fusion.gain).toBeLessThanOrEqual(0.029);
  });

  it("makes semantic ownership explicit and preserves intentional silence", () => {
    expect(SONIC_OWNERSHIP.projectSelect).toBe("vaeora");
    expect(SONIC_OWNERSHIP.auraLive).toBe("iaura");
    expect(SONIC_OWNERSHIP.presenceManifestation).toBe("presence");
    expect(SONIC_OWNERSHIP.hover).toBe("silent");
    expect(SONIC_OWNERSHIP.scroll).toBe("silent");
  });

  it("reuses AudioContext for IAURA and Fusion and cancels stacked Presence cues", () => {
    expect(sonicEngine.playIaura("activation")).toBe(true);
    const first = sonicEngine.playPresence();
    const second = sonicEngine.playPresence();
    expect(first).not.toBeNull(); expect(second).not.toBeNull(); expect(second).not.toBe(first);
    expect(audioContext).toHaveBeenCalledTimes(1);
    sonicEngine.cancelPresence(second);
  });

  it("simplifies Presence timing for reduced motion and suppresses both identities during voice", () => {
    const regular = resolvePresenceFusionProfile(undefined, "balanced", false);
    const reduced = resolvePresenceFusionProfile(undefined, "balanced", true);
    expect(reduced.duration).toBeLessThan(regular.duration);
    expect(reduced.settleAt).toBeLessThan(reduced.duration);
    sonicEngine.setVoiceActive(true);
    expect(sonicEngine.playIaura("completion")).toBe(false);
    expect(sonicEngine.playPresence()).toBeNull();
  });

  it("lets the authoritative current voice state override a stale sonic suppression snapshot", () => {
    sonicEngine.setVoiceActive(true);
    expect(sonicEngine.playIaura("activation", undefined, "hybrid", false)).toBe(true);
    sonicEngine.setVoiceActive(false);
    expect(sonicEngine.playIaura("activation", undefined, "hybrid", true)).toBe(false);
  });

  it("keeps IAURA and Presence candidate families bounded and distinct", () => {
    const iaura = (["ethereal", "cognitive", "hybrid"] as const).map((candidate) => resolveIauraProfile("completion", undefined, candidate));
    const presence = (["vaeora-led", "iaura-led", "balanced"] as const).map((candidate) => resolvePresenceFusionProfile(undefined, candidate));
    expect(new Set(iaura.map((profile) => profile.root)).size).toBe(3);
    expect(new Set(presence.map((profile) => profile.vaeoraRoot)).size).toBe(3);
    expect(iaura.every((profile) => profile.duration <= 0.25 && profile.gain <= 0.026)).toBe(true);
    expect(presence.every((profile) => profile.duration <= 0.39 && profile.gain <= 0.029)).toBe(true);
  });
});
