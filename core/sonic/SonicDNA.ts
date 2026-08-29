import { DEFAULT_PROJECT_THEME_DNA, normalizeThemeDNA } from "@/core/projectTheme/themeDNA";
import type { ProjectThemeDNA } from "@/core/projectTheme/types";

export type SonicRole = "tap" | "navigation" | "select" | "open" | "close" | "confirm" | "apply" | "cancel" | "completion" | "attention";
export type SonicCandidate = "deep" | "crystalline" | "hybrid";
export type IauraCandidate = "ethereal" | "cognitive" | "hybrid";
export type PresenceCandidate = "vaeora-led" | "iaura-led" | "balanced";
export type IauraRole = "activation" | "acknowledgement" | "completion";
export type SonicOwner = "vaeora" | "iaura" | "presence" | "silent";

export const SONIC_OWNERSHIP = {
  projectSelect: "vaeora", workspaceNavigation: "vaeora", brandSystem: "vaeora",
  brandAssets: "vaeora", imageLab: "vaeora", creativeDirection: "vaeora",
  websiteKit: "vaeora", library: "vaeora", identityApply: "vaeora",
  projectCreate: "vaeora", auraLive: "iaura", iauraSubmit: "presence",
  iauraCompletion: "iaura", presenceManifestation: "presence",
  hover: "silent", scroll: "silent", passiveState: "silent", tinyDismiss: "silent",
} as const satisfies Record<string, SonicOwner>;

export interface SonicProfile {
  duration: number;
  attack: number;
  gain: number;
  root: number;
  interval: number;
  brightness: number;
  transientMix: number;
  resonanceMix: number;
  cutoff: number;
}

const ROLE_SHAPE: Record<SonicRole, { duration: number; interval: number; energy: number; transient: number; resonance: number }> = {
  tap: { duration: 0.052, interval: 1.08, energy: 0.68, transient: 0.2, resonance: 0.12 },
  navigation: { duration: 0.112, interval: 1.16, energy: 0.73, transient: 0.16, resonance: 0.17 },
  select: { duration: 0.088, interval: 1.1, energy: 0.78, transient: 0.25, resonance: 0.2 },
  open: { duration: 0.148, interval: 1.27, energy: 0.78, transient: 0.16, resonance: 0.22 },
  close: { duration: 0.086, interval: 0.88, energy: 0.65, transient: 0.18, resonance: 0.14 },
  confirm: { duration: 0.18, interval: 1.36, energy: 0.84, transient: 0.22, resonance: 0.3 },
  apply: { duration: 0.198, interval: 1.4, energy: 0.86, transient: 0.24, resonance: 0.34 },
  cancel: { duration: 0.078, interval: 0.9, energy: 0.61, transient: 0.14, resonance: 0.12 },
  completion: { duration: 0.23, interval: 1.42, energy: 0.89, transient: 0.2, resonance: 0.38 },
  attention: { duration: 0.112, interval: 0.94, energy: 0.76, transient: 0.28, resonance: 0.2 },
};
const ROLE_DURATION_BOUNDS: Record<SonicRole, readonly [number, number]> = {
  tap: [0.04, 0.09], navigation: [0.07, 0.14], select: [0.06, 0.14],
  open: [0.1, 0.18], close: [0.05, 0.12], cancel: [0.045, 0.11],
  confirm: [0.14, 0.24], apply: [0.14, 0.24], completion: [0.17, 0.28], attention: [0.07, 0.15],
};

export interface AuditionProfile {
  candidate: SonicCandidate;
  duration: number;
  gain: number;
  attack: number;
  root: number;
  interval: number;
  bodyType: OscillatorType;
  filterType: BiquadFilterType;
  cutoff: number;
  resonanceRatio: number;
  resonanceMix: number;
  airRatio: number;
  airMix: number;
  transientType: OscillatorType;
  transientMix: number;
}

export interface IauraProfile {
  duration: number; gain: number; attack: number; root: number; interval: number;
  fluidRatio: number; lightRatio: number; lightMix: number; cutoff: number;
}

export interface PresenceFusionProfile {
  duration: number; gain: number; seedAt: number; emergenceAt: number;
  expansionAt: number; settleAt: number; vaeoraRoot: number; iauraRoot: number;
  reducedMotion: boolean;
}

const IAURA_ROLE = {
  activation: { duration: 0.176, interval: 1.22, energy: 0.78 },
  acknowledgement: { duration: 0.118, interval: 1.12, energy: 0.67 },
  completion: { duration: 0.224, interval: 1.31, energy: 0.84 },
} as const;

export function resolveIauraProfile(role: IauraRole, value?: ProjectThemeDNA | null, candidate: IauraCandidate = "hybrid"): IauraProfile {
  const dna = normalizeThemeDNA(value ?? DEFAULT_PROJECT_THEME_DNA);
  const shape = IAURA_ROLE[role];
  const motion = { calm: [1.08, 0.01], fluid: [1, 0.007], dynamic: [0.86, 0.003], precision: [0.76, 0.002] }[dna.motionStyle];
  const identity = {
    ethereal: { root: 326, fluid: 1.498, light: 2.12, mix: 0.13, cutoff: 1480 },
    cognitive: { root: 286, fluid: 1.334, light: 1.82, mix: 0.085, cutoff: 1210 },
    hybrid: { root: 304, fluid: 1.414, light: 1.96, mix: 0.105, cutoff: 1360 },
  }[candidate];
  return {
    duration: Math.min(0.25, shape.duration * motion[0]), gain: Math.min(0.026, 0.025 * shape.energy),
    attack: motion[1], root: identity.root, interval: shape.interval, fluidRatio: identity.fluid,
    lightRatio: identity.light, lightMix: identity.mix, cutoff: identity.cutoff,
  };
}

export function resolvePresenceFusionProfile(value?: ProjectThemeDNA | null, candidate: PresenceCandidate = "balanced", reducedMotion = false): PresenceFusionProfile {
  const dna = normalizeThemeDNA(value ?? DEFAULT_PROJECT_THEME_DNA);
  const motionScale = { calm: 1.08, fluid: 1, dynamic: 0.9, precision: 0.84 }[dna.motionStyle];
  const bias = { "vaeora-led": [210, 296, 0.029], "iaura-led": [224, 326, 0.027], balanced: [218, 310, 0.028] }[candidate];
  const duration = reducedMotion ? 0.22 : Math.min(0.39, 0.34 * motionScale);
  return {
    duration, gain: bias[2], seedAt: 0, emergenceAt: reducedMotion ? 0.052 : duration * 0.27,
    expansionAt: reducedMotion ? 0.105 : duration * 0.55, settleAt: reducedMotion ? 0.17 : duration * 0.88,
    vaeoraRoot: bias[0], iauraRoot: bias[1], reducedMotion,
  };
}

const CANDIDATE_DNA = {
  deep: { root: 196, duration: 1.08, gain: 0.9, bodyType: "sine", filterType: "lowpass", cutoff: 720, resonanceRatio: 0.505, resonanceMix: 0.38, airRatio: 2.04, airMix: 0.05, transientType: "triangle", transientMix: 0.18 },
  crystalline: { root: 262, duration: 0.86, gain: 0.82, bodyType: "triangle", filterType: "bandpass", cutoff: 1240, resonanceRatio: 1.49, resonanceMix: 0.1, airRatio: 2.62, airMix: 0.14, transientType: "sawtooth", transientMix: 0.075 },
  hybrid: { root: 218, duration: 0.98, gain: 0.92, bodyType: "triangle", filterType: "lowpass", cutoff: 940, resonanceRatio: 0.505, resonanceMix: 0.26, airRatio: 2.18, airMix: 0.095, transientType: "sawtooth", transientMix: 0.1 },
} as const satisfies Record<SonicCandidate, object>;

export function resolveAuditionProfile(candidate: SonicCandidate, role: SonicRole, value?: ProjectThemeDNA | null): AuditionProfile {
  const dna = normalizeThemeDNA(value ?? DEFAULT_PROJECT_THEME_DNA);
  const base = CANDIDATE_DNA[candidate];
  const shape = ROLE_SHAPE[role];
  const motion = {
    calm: { duration: 1.1, attack: 0.011, energy: 0.86, clarity: 0.92 },
    fluid: { duration: 1.04, attack: 0.008, energy: 0.92, clarity: 1 },
    dynamic: { duration: 0.84, attack: 0.003, energy: 1.02, clarity: 0.95 },
    precision: { duration: 0.72, attack: 0.002, energy: 0.94, clarity: 0.88 },
  }[dna.motionStyle];
  const [minimumDuration, maximumDuration] = ROLE_DURATION_BOUNDS[role];
  const intensityRichness = { subtle: 0.9, balanced: 1, bold: 1.08 }[dna.visualIntensity];
  return {
    candidate,
    duration: Math.min(0.29, maximumDuration, Math.max(minimumDuration, shape.duration * base.duration * motion.duration)),
    gain: Math.min(0.028, 0.026 * shape.energy * base.gain * motion.energy),
    attack: motion.attack,
    root: base.root,
    interval: candidate === "deep" ? 1 + (shape.interval - 1) * 0.55 : candidate === "crystalline" ? 1 + (shape.interval - 1) * 1.12 : 1 + (shape.interval - 1) * 0.82,
    bodyType: base.bodyType,
    filterType: base.filterType,
    cutoff: base.cutoff * motion.clarity,
    resonanceRatio: base.resonanceRatio,
    resonanceMix: base.resonanceMix * shape.resonance * 3.2 * intensityRichness,
    airRatio: base.airRatio,
    airMix: Math.min(0.16, base.airMix * intensityRichness),
    transientType: base.transientType,
    transientMix: base.transientMix * (role === "tap" || role === "select" || role === "apply" ? 1.1 : 0.9),
  };
}

export function resolveSonicProfile(role: SonicRole, value?: ProjectThemeDNA | null): SonicProfile {
  const dna = normalizeThemeDNA(value ?? DEFAULT_PROJECT_THEME_DNA);
  const shape = ROLE_SHAPE[role];
  const motion = {
    calm: { duration: 1.14, attack: 0.011, energy: 0.84, blend: 0.92 },
    fluid: { duration: 1.06, attack: 0.008, energy: 0.92, blend: 1.04 },
    dynamic: { duration: 0.84, attack: 0.003, energy: 1.04, blend: 0.94 },
    precision: { duration: 0.72, attack: 0.002, energy: 0.94, blend: 0.86 },
  }[dna.motionStyle];
  const intensity = { subtle: 0.88, balanced: 0.94, bold: 1 }[dna.visualIntensity];
  const richness = { subtle: 0.88, balanced: 1, bold: 1.1 }[dna.visualIntensity];
  const colorEnergy = [1, 3, 5]
    .map((index) => Number.parseInt(dna.primaryColor.slice(index, index + 2), 16))
    .reduce((sum, channel) => sum + channel, 0) / (255 * 3);
  const [minimumDuration, maximumDuration] = ROLE_DURATION_BOUNDS[role];
  return {
    duration: Math.min(maximumDuration, Math.max(minimumDuration, shape.duration * motion.duration)),
    attack: motion.attack,
    gain: Math.min(0.032, 0.026 * shape.energy * motion.energy * intensity),
    root: 244,
    interval: shape.interval,
    brightness: Math.min(0.17, (0.09 + colorEnergy * 0.035) * richness * motion.blend),
    transientMix: shape.transient * (dna.motionStyle === "dynamic" ? 1.12 : dna.motionStyle === "calm" ? 0.82 : 1),
    resonanceMix: shape.resonance * richness * motion.blend,
    cutoff: 920 + colorEnergy * 180,
  };
}

export const SONIC_PREFERENCE_KEY = "vaeora.interface-sounds.v1";
export const SONIC_PREFERENCE_EVENT = "vaeora:interface-sounds";

export function interfaceSoundsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(SONIC_PREFERENCE_KEY) !== "false"; } catch { return true; }
}

export function setInterfaceSoundsEnabled(enabled: boolean): void {
  try { window.localStorage.setItem(SONIC_PREFERENCE_KEY, String(enabled)); } catch { /* preference remains session-safe */ }
  window.dispatchEvent(new Event(SONIC_PREFERENCE_EVENT));
}

type AudioContextConstructor = typeof AudioContext;

export class SonicEngine {
  private context: AudioContext | null = null;
  private suppressed = false;
  private lastPlayed = new Map<SonicRole, number>();
  private lastAuditionPlayed = new Map<string, number>();
  private presenceSequence = 0;
  private activePresence = new Map<number, OscillatorNode[]>();

  setVoiceActive(active: boolean): void { this.suppressed = active; }

  private audioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!AudioContextClass) return null;
    this.context ??= new AudioContextClass();
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  playIaura(role: IauraRole, theme?: ProjectThemeDNA | null, candidate: IauraCandidate = "hybrid", voiceActiveOverride?: boolean): boolean {
    if ((voiceActiveOverride ?? this.suppressed) || !interfaceSoundsEnabled()) return false;
    try {
      const context = this.audioContext(); if (!context) return false;
      const profile = resolveIauraProfile(role, theme, candidate); const now = context.currentTime;
      const master = context.createGain(); master.gain.setValueAtTime(0.0001, now); master.gain.exponentialRampToValueAtTime(profile.gain, now + profile.attack); master.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration); master.connect(context.destination);
      const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = profile.cutoff; filter.Q.value = 0.58; filter.connect(master);
      const impulseGain = context.createGain(); impulseGain.gain.setValueAtTime(0.18, now); impulseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018); impulseGain.connect(filter);
      const impulse = context.createOscillator(); impulse.type = "triangle"; impulse.frequency.setValueAtTime(profile.root * 1.62, now); impulse.frequency.exponentialRampToValueAtTime(profile.root, now + 0.016); impulse.connect(impulseGain);
      const body = context.createOscillator(); body.type = "sine"; body.frequency.setValueAtTime(profile.root, now); body.frequency.exponentialRampToValueAtTime(profile.root * profile.interval, now + profile.duration * 0.68); body.connect(filter);
      const livingGain = context.createGain(); livingGain.gain.value = 0.18; livingGain.connect(filter); const living = context.createOscillator(); living.type = "triangle"; living.frequency.value = profile.root * profile.fluidRatio; living.detune.value = -4; living.connect(livingGain);
      const lightGain = context.createGain(); lightGain.gain.value = profile.lightMix; lightGain.connect(master); const light = context.createOscillator(); light.type = "sine"; light.frequency.value = profile.root * profile.lightRatio; light.detune.value = 5; light.connect(lightGain);
      impulse.start(now); body.start(now); living.start(now + profile.attack); light.start(now + profile.duration * 0.24);
      impulse.stop(now + 0.022); body.stop(now + profile.duration); living.stop(now + profile.duration * 0.9); light.stop(now + profile.duration * 0.82);
      body.onended = () => { impulse.disconnect(); body.disconnect(); living.disconnect(); light.disconnect(); impulseGain.disconnect(); livingGain.disconnect(); lightGain.disconnect(); filter.disconnect(); master.disconnect(); };
      return true;
    } catch { return false; }
  }

  playPresence(theme?: ProjectThemeDNA | null, candidate: PresenceCandidate = "balanced", reducedMotion = false): number | null {
    if (this.suppressed || !interfaceSoundsEnabled()) return null;
    try {
      const context = this.audioContext(); if (!context) return null;
      this.cancelPresence();
      const profile = resolvePresenceFusionProfile(theme, candidate, reducedMotion); const now = context.currentTime; const id = ++this.presenceSequence;
      const master = context.createGain(); master.gain.setValueAtTime(0.0001, now); master.gain.exponentialRampToValueAtTime(profile.gain, now + 0.012); master.gain.setValueAtTime(profile.gain * 0.72, now + profile.expansionAt); master.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration); master.connect(context.destination);
      const makeLayer = (type: OscillatorType, start: number, stopAt: number, from: number, to: number, mix: number) => { const layerGain = context.createGain(); layerGain.gain.value = mix; layerGain.connect(master); const node = context.createOscillator(); node.type = type; node.frequency.setValueAtTime(from, now + start); node.frequency.exponentialRampToValueAtTime(to, now + stopAt); node.connect(layerGain); node.start(now + start); node.stop(now + stopAt); return node; };
      const nodes = [
        makeLayer("triangle", profile.seedAt, profile.duration, profile.vaeoraRoot, profile.vaeoraRoot * 1.08, 0.72),
        makeLayer("sine", profile.emergenceAt, profile.duration * 0.96, profile.iauraRoot, profile.iauraRoot * 1.24, 0.42),
        makeLayer("sine", profile.expansionAt, profile.duration * 0.9, profile.iauraRoot * 1.96, profile.iauraRoot * 2.04, 0.085),
        makeLayer("sine", profile.settleAt, profile.duration, profile.vaeoraRoot * 1.5, profile.iauraRoot * 1.06, 0.18),
      ];
      this.activePresence.set(id, nodes); nodes[0].onended = () => { if (this.activePresence.get(id) === nodes) this.activePresence.delete(id); nodes.forEach((node) => node.disconnect()); master.disconnect(); };
      return id;
    } catch { return null; }
  }

  cancelPresence(id?: number | null): void {
    for (const [sequence, nodes] of this.activePresence) {
      if (id != null && sequence !== id) continue;
      nodes.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } try { node.disconnect(); } catch { /* already disconnected */ } });
      this.activePresence.delete(sequence);
    }
  }

  playAudition(candidate: SonicCandidate, role: SonicRole, theme?: ProjectThemeDNA | null): boolean {
    if (this.suppressed || !interfaceSoundsEnabled() || typeof window === "undefined") return false;
    const timestamp = performance.now();
    const auditionKey = `${candidate}:${role}`;
    const cooldown = role === "tap" ? 34 : role === "navigation" ? 44 : role === "select" ? 48 : 0;
    if (cooldown > 0 && timestamp - (this.lastAuditionPlayed.get(auditionKey) ?? -Infinity) < cooldown) return false;
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      this.context ??= new AudioContextClass();
      if (this.context.state === "suspended") void this.context.resume();
      const profile = resolveAuditionProfile(candidate, role, theme);
      const now = this.context.currentTime;
      const master = this.context.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(profile.gain, now + profile.attack);
      master.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
      master.connect(this.context.destination);

      const filter = this.context.createBiquadFilter();
      filter.type = profile.filterType;
      filter.frequency.value = profile.cutoff;
      filter.Q.value = candidate === "crystalline" ? 0.72 : 0.9;
      filter.connect(master);

      const body = this.context.createOscillator();
      body.type = profile.bodyType;
      body.frequency.setValueAtTime(profile.root, now);
      body.frequency.exponentialRampToValueAtTime(profile.root * profile.interval, now + profile.duration * 0.72);
      body.connect(filter);

      const resonanceGain = this.context.createGain();
      resonanceGain.gain.value = profile.resonanceMix;
      resonanceGain.connect(filter);
      const resonance = this.context.createOscillator();
      resonance.type = candidate === "crystalline" ? "triangle" : "sine";
      resonance.frequency.value = profile.root * profile.resonanceRatio;
      resonance.detune.value = candidate === "deep" ? -5 : 3;
      resonance.connect(resonanceGain);

      const airGain = this.context.createGain();
      airGain.gain.value = profile.airMix;
      airGain.connect(master);
      const air = this.context.createOscillator();
      air.type = "sine";
      air.frequency.value = profile.root * profile.airRatio;
      air.detune.value = candidate === "crystalline" ? 6 : 3;
      air.connect(airGain);

      const transientGain = this.context.createGain();
      transientGain.gain.setValueAtTime(profile.transientMix, now);
      transientGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(0.022, profile.duration * 0.3));
      transientGain.connect(filter);
      const transient = this.context.createOscillator();
      transient.type = profile.transientType;
      transient.frequency.setValueAtTime(profile.root * (candidate === "deep" ? 1.18 : 1.58), now);
      transient.frequency.exponentialRampToValueAtTime(profile.root * 0.98, now + Math.min(0.02, profile.duration * 0.26));
      transient.connect(transientGain);

      body.start(now); resonance.start(now); transient.start(now); air.start(now + profile.attack * 1.2);
      body.stop(now + profile.duration); resonance.stop(now + profile.duration * (candidate === "deep" ? 0.96 : 0.82));
      transient.stop(now + Math.min(0.024, profile.duration * 0.34)); air.stop(now + profile.duration * (candidate === "crystalline" ? 0.92 : 0.78));
      this.lastAuditionPlayed.set(auditionKey, timestamp);
      body.onended = () => {
        body.disconnect(); resonance.disconnect(); transient.disconnect(); air.disconnect();
        resonanceGain.disconnect(); transientGain.disconnect(); airGain.disconnect(); filter.disconnect(); master.disconnect();
      };
      return true;
    } catch { return false; }
  }

  play(role: SonicRole, theme?: ProjectThemeDNA | null): boolean {
    if (this.suppressed || !interfaceSoundsEnabled() || typeof window === "undefined") return false;
    const timestamp = performance.now();
    const cooldown = { tap: 34, navigation: 44, select: 48, open: 52, close: 38, cancel: 38 }[role as "tap" | "navigation" | "select" | "open" | "close" | "cancel"] ?? 0;
    if (cooldown > 0 && timestamp - (this.lastPlayed.get(role) ?? -Infinity) < cooldown) return false;
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      this.context ??= new AudioContextClass();
      if (this.context.state === "suspended") void this.context.resume();
      const now = this.context.currentTime;
      const profile = resolveSonicProfile(role, theme);
      const master = this.context.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(profile.gain, now + profile.attack);
      master.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
      master.connect(this.context.destination);

      const body = this.context.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(profile.root, now);
      body.frequency.exponentialRampToValueAtTime(profile.root * profile.interval, now + profile.duration * 0.7);
      const bodyFilter = this.context.createBiquadFilter();
      bodyFilter.type = "lowpass";
      bodyFilter.frequency.value = profile.cutoff;
      bodyFilter.Q.value = 0.7;
      body.connect(bodyFilter);
      bodyFilter.connect(master);

      const resonanceGain = this.context.createGain();
      resonanceGain.gain.value = profile.resonanceMix;
      resonanceGain.connect(bodyFilter);
      const resonance = this.context.createOscillator();
      resonance.type = "sine";
      resonance.frequency.value = profile.root * 0.505;
      resonance.detune.value = -3;
      resonance.connect(resonanceGain);

      const shimmerGain = this.context.createGain();
      shimmerGain.gain.value = profile.brightness;
      shimmerGain.connect(master);
      const shimmer = this.context.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = profile.root * 2.01;
      shimmer.detune.value = 4;
      shimmer.connect(shimmerGain);

      const transientGain = this.context.createGain();
      transientGain.gain.setValueAtTime(profile.transientMix, now);
      transientGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(0.024, profile.duration * 0.34));
      transientGain.connect(bodyFilter);
      const transient = this.context.createOscillator();
      transient.type = "triangle";
      transient.frequency.setValueAtTime(profile.root * 1.42, now);
      transient.frequency.exponentialRampToValueAtTime(profile.root * 0.96, now + Math.min(0.022, profile.duration * 0.3));
      transient.connect(transientGain);

      body.start(now); resonance.start(now); transient.start(now); shimmer.start(now + profile.attack);
      body.stop(now + profile.duration); resonance.stop(now + profile.duration * 0.9); transient.stop(now + Math.min(0.026, profile.duration * 0.38)); shimmer.stop(now + profile.duration * 0.78);
      this.lastPlayed.set(role, timestamp);
      body.onended = () => {
        body.disconnect(); resonance.disconnect(); transient.disconnect(); shimmer.disconnect();
        resonanceGain.disconnect(); transientGain.disconnect(); shimmerGain.disconnect(); bodyFilter.disconnect(); master.disconnect();
      };
      return true;
    } catch { return false; }
  }

  resetForTests(): void { this.cancelPresence(); this.context = null; this.suppressed = false; this.lastPlayed.clear(); this.lastAuditionPlayed.clear(); }
}

export const sonicEngine = new SonicEngine();
