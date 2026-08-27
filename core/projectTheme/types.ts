export const PROJECT_THEME_DNA_VERSION = 1 as const;

export type ProjectSurfaceMode = "light" | "dark" | "adaptive";
export type ProjectVisualIntensity = "subtle" | "balanced" | "bold";
export type ProjectSurfacePersonality = "soft" | "crisp" | "glass" | "editorial";
export type ProjectMotionPersonality = "calm" | "fluid" | "dynamic" | "precision";

export interface ProjectThemeDNA {
  version: typeof PROJECT_THEME_DNA_VERSION;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceMode: ProjectSurfaceMode;
  visualIntensity: ProjectVisualIntensity;
  surfacePersonality: ProjectSurfacePersonality;
  motionStyle: ProjectMotionPersonality;
  presetId?: string;
  userLabel?: string;
}

export interface ProjectMotionSignature {
  direction: "left" | "right" | "up" | "down";
  distance: number;
  scale: number;
  microDuration: number;
  normalDuration: number;
  contextDuration: number;
  stagger: number;
  sequence: "forward" | "reverse" | "center-out";
  easing: string;
  ambientX: number;
  ambientY: number;
  sweepAngle: number;
}
