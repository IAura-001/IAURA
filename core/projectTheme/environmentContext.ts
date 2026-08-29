import type { ProjectMotionSignature, ProjectThemeDNA } from "./types";

export type ProjectEnvironmentContext =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "creating"
  | "reviewing"
  | "completed"
  | "attention";

export interface ProjectEnvironmentSignals {
  activeView: "presence" | "projects" | "intelligence";
  voiceState: "idle" | "listening" | "processing" | "speaking";
  isSending: boolean;
  temporaryState?: "completed" | "attention" | null;
}

export function projectEnvironmentContext(signals: ProjectEnvironmentSignals): ProjectEnvironmentContext {
  if (signals.voiceState !== "idle") return signals.voiceState;
  if (signals.isSending) return "processing";
  if (signals.temporaryState) return signals.temporaryState;
  if (signals.activeView === "projects") return "creating";
  if (signals.activeView === "intelligence") return "reviewing";
  return "idle";
}

export type AdaptiveEnvironmentTokens = Record<`--living-${string}`, string>;

export function resolveAdaptiveEnvironment(
  dna: ProjectThemeDNA,
  motion: ProjectMotionSignature,
  context: ProjectEnvironmentContext,
): AdaptiveEnvironmentTokens {
  const response = {
    calm: { energy: 0.72, settle: 1.16 },
    fluid: { energy: 0.9, settle: 1.08 },
    dynamic: { energy: 1.18, settle: 0.82 },
    precision: { energy: 0.96, settle: 0.72 },
  }[dna.motionStyle];
  const state = {
    idle: { ambient: 0.58, depth: 1, glow: 1, rings: 1, particles: 1, focus: 1 },
    listening: { ambient: 0.5, depth: 1.08, glow: 1.2, rings: 1.15, particles: 0.84, focus: 0.96 },
    processing: { ambient: 0.46, depth: 1.14, glow: 1.32, rings: 1.28, particles: 0.72, focus: 0.9 },
    speaking: { ambient: 0.55, depth: 1.1, glow: 1.25, rings: 1.08, particles: 1.06, focus: 0.95 },
    creating: { ambient: 0.66, depth: 1.08, glow: 1.1, rings: 1.04, particles: 1, focus: 0.96 },
    reviewing: { ambient: 0.44, depth: 1.04, glow: 0.94, rings: 0.88, particles: 0.68, focus: 0.92 },
    completed: { ambient: 0.7, depth: 1.1, glow: 1.38, rings: 1.18, particles: 0.9, focus: 1 },
    attention: { ambient: 0.64, depth: 1.08, glow: 1.22, rings: 1.12, particles: 0.82, focus: 0.96 },
  }[context];
  const intensity = dna.visualIntensity === "subtle" ? 0.78 : dna.visualIntensity === "bold" ? 1.16 : 1;
  const bounded = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  return {
    "--living-ambient-opacity": bounded(state.ambient * intensity, 0.34, 0.82).toFixed(2),
    "--living-surface-depth": bounded(state.depth * response.energy, 0.82, 1.32).toFixed(2),
    "--living-glow-multiplier": bounded(state.glow * response.energy * intensity, 0.68, 1.52).toFixed(2),
    "--living-ring-multiplier": bounded(state.rings * response.energy, 0.68, 1.4).toFixed(2),
    "--living-particle-multiplier": bounded(state.particles * intensity, 0.52, 1.16).toFixed(2),
    "--living-focus-opacity": state.focus.toFixed(2),
    "--living-response-duration": `${Math.round(motion.normalDuration * response.settle)}ms`,
    "--living-event-duration": `${Math.round(Math.min(900, Math.max(300, motion.contextDuration * response.settle)))}ms`,
    "--living-shift-x": `${Math.round(motion.distance * 0.35)}px`,
  };
}
