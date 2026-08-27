import {
  PROJECT_THEME_DNA_VERSION,
  type ProjectMotionPersonality,
  type ProjectMotionSignature,
  type ProjectSurfaceMode,
  type ProjectSurfacePersonality,
  type ProjectThemeDNA,
  type ProjectVisualIntensity,
} from "./types";

export const DEFAULT_PROJECT_THEME_DNA: ProjectThemeDNA = {
  version: PROJECT_THEME_DNA_VERSION,
  primaryColor: "#7764E8",
  secondaryColor: "#3B82F6",
  accentColor: "#AAA0FF",
  surfaceMode: "dark",
  visualIntensity: "subtle",
  surfacePersonality: "soft",
  motionStyle: "calm",
};

const SURFACE_MODES: ProjectSurfaceMode[] = ["light", "dark", "adaptive"];
const INTENSITIES: ProjectVisualIntensity[] = ["subtle", "balanced", "bold"];
const SURFACES: ProjectSurfacePersonality[] = ["soft", "crisp", "glass", "editorial"];
const MOTIONS: ProjectMotionPersonality[] = ["calm", "fluid", "dynamic", "precision"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9A-F]{3}$/.test(normalized)) {
    return `#${normalized.slice(1).split("").map((part) => part + part).join("")}`;
  }
  return fallback;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback;
}

export function normalizeThemeDNA(value: unknown): ProjectThemeDNA {
  const source = isRecord(value) ? value : {};
  if (
    typeof source.version === "number" &&
    source.version !== PROJECT_THEME_DNA_VERSION
  ) {
    return { ...DEFAULT_PROJECT_THEME_DNA };
  }
  return {
    version: PROJECT_THEME_DNA_VERSION,
    primaryColor: normalizeHex(source.primaryColor, DEFAULT_PROJECT_THEME_DNA.primaryColor),
    secondaryColor: normalizeHex(source.secondaryColor, DEFAULT_PROJECT_THEME_DNA.secondaryColor),
    accentColor: normalizeHex(source.accentColor, DEFAULT_PROJECT_THEME_DNA.accentColor),
    surfaceMode: enumValue(source.surfaceMode, SURFACE_MODES, DEFAULT_PROJECT_THEME_DNA.surfaceMode),
    visualIntensity: enumValue(source.visualIntensity, INTENSITIES, DEFAULT_PROJECT_THEME_DNA.visualIntensity),
    surfacePersonality: enumValue(source.surfacePersonality, SURFACES, DEFAULT_PROJECT_THEME_DNA.surfacePersonality),
    motionStyle: enumValue(source.motionStyle ?? source.motionPersonality, MOTIONS, DEFAULT_PROJECT_THEME_DNA.motionStyle),
    ...(typeof source.presetId === "string" && source.presetId.trim()
      ? { presetId: source.presetId.trim().slice(0, 80) }
      : {}),
    ...(typeof source.userLabel === "string" && source.userLabel.trim()
      ? { userLabel: source.userLabel.trim().slice(0, 80) }
      : {}),
  };
}

type RGB = { r: number; g: number; b: number };
const rgb = (hex: string): RGB => ({
  r: Number.parseInt(hex.slice(1, 3), 16),
  g: Number.parseInt(hex.slice(3, 5), 16),
  b: Number.parseInt(hex.slice(5, 7), 16),
});
const channel = (value: number) => {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const color = rgb(hex);
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
};
export const contrastRatio = (foreground: string, background: string) => {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};
export const readableForeground = (background: string): "#FFFFFF" | "#11131A" =>
  contrastRatio("#FFFFFF", background) >= contrastRatio("#11131A", background)
    ? "#FFFFFF"
    : "#11131A";
const rgba = (hex: string, alpha: number) => {
  const color = rgb(hex);
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
};
const mix = (a: string, b: string, amount: number) => {
  const first = rgb(a); const second = rgb(b);
  const value = (key: keyof RGB) => Math.round(first[key] * (1 - amount) + second[key] * amount).toString(16).padStart(2, "0");
  return `#${value("r")}${value("g")}${value("b")}`.toUpperCase();
};

const channels = (hex: string) => {
  const color = rgb(hex);
  return `${color.r}, ${color.g}, ${color.b}`;
};

function readableText(base: string, surface: string, blend: number, minimum = 4.5) {
  let candidate = mix(base, surface, blend);
  const target = readableForeground(surface);
  for (let attempt = 0; attempt < 12 && contrastRatio(candidate, surface) < minimum; attempt += 1) {
    candidate = mix(candidate, target, 0.1);
  }
  return candidate;
}

function accessibleAction(primary: string): { background: string; foreground: "#FFFFFF" | "#11131A" } {
  const foreground = readableForeground(primary);
  let background = primary;
  const target = foreground === "#FFFFFF" ? "#000000" : "#FFFFFF";
  for (let attempt = 0; attempt < 8 && contrastRatio(foreground, background) < 4.5; attempt += 1) {
    background = mix(background, target, 0.08);
  }
  return { background, foreground };
}

export type ProjectThemeTokens = Record<`--project-${string}` | `--iaura-${string}`, string>;

export function resolveProjectTheme(value: unknown, prefersDark = true): {
  dna: ProjectThemeDNA;
  tokens: ProjectThemeTokens;
} {
  const dna = normalizeThemeDNA(value);
  const dark = dna.surfaceMode === "dark" || (dna.surfaceMode === "adaptive" && prefersDark);
  const base = dark ? "#070810" : "#F8F6F0";
  const text = dark ? "#F7F7FA" : "#171820";
  const strength = dna.visualIntensity === "subtle" ? 0.08 : dna.visualIntensity === "bold" ? 0.2 : 0.13;
  const surface = mix(base, dark ? "#FFFFFF" : "#000000", dark ? 0.045 : 0.025);
  const elevated = mix(surface, dark ? "#FFFFFF" : "#000000", dark ? 0.055 : 0.04);
  const action = accessibleAction(dna.primaryColor);
  const textSecondary = readableText(text, elevated, dark ? 0.28 : 0.25);
  const textMuted = readableText(text, elevated, dark ? 0.42 : 0.4);
  const textSubtle = readableText(text, elevated, dark ? 0.52 : 0.48);
  const link = contrastRatio(dna.primaryColor, elevated) >= 4.5 ? dna.primaryColor : readableText(dna.primaryColor, elevated, 0.12);
  const iauraWeight = dna.visualIntensity === "subtle" ? 0.2 : dna.visualIntensity === "bold" ? 0.58 : 0.38;
  const iauraPrimary = mix("#A855F7", dna.primaryColor, iauraWeight);
  const iauraSecondary = mix("#3B82F6", dna.secondaryColor, iauraWeight);
  const iauraAccent = mix("#D8B4FE", dna.accentColor, Math.min(0.66, iauraWeight + 0.08));
  const richDarkSurface = mix("#090811", iauraPrimary, strength * 0.5);
  const richDarkElevated = mix(richDarkSurface, "#FFFFFF", 0.055);
  const richLightSurface = mix("#FBFAF7", dna.primaryColor, strength * 0.28);
  const richLightElevated = mix(richLightSurface, "#000000", 0.035);
  const richDarkText = "#F7F5FA";
  const richLightText = "#171820";
  return { dna, tokens: {
    "--project-primary": dna.primaryColor,
    "--project-secondary": dna.secondaryColor,
    "--project-accent": dna.accentColor,
    "--project-bg": base,
    "--project-bg-subtle": mix(base, dna.primaryColor, strength),
    "--project-surface": surface,
    "--project-surface-elevated": elevated,
    "--project-surface-hover": mix(surface, dna.primaryColor, strength),
    "--project-active": rgba(dna.primaryColor, dna.visualIntensity === "bold" ? 0.28 : strength + 0.06),
    "--project-highlight": rgba(dna.accentColor, strength + 0.04),
    "--project-border": rgba(dna.primaryColor, dark ? 0.22 : 0.28),
    "--project-border-strong": rgba(dna.accentColor, 0.52),
    "--project-text": text,
    "--project-text-secondary": textSecondary,
    "--project-text-muted": textMuted,
    "--project-text-subtle": textSubtle,
    "--project-metadata": textMuted,
    "--project-placeholder": textSubtle,
    "--project-link": link,
    "--project-link-hover": mix(link, text, 0.22),
    "--project-action": action.background,
    "--project-action-hover": mix(action.background, action.foreground, 0.12),
    "--project-action-text": action.foreground,
    "--project-focus": contrastRatio(dna.accentColor, base) >= 3 ? dna.accentColor : dark ? "#FFFFFF" : "#11131A",
    "--project-accent-soft": rgba(dna.accentColor, strength),
    "--project-primary-soft": rgba(dna.primaryColor, strength),
    "--project-secondary-soft": rgba(dna.secondaryColor, strength),
    "--project-glow": rgba(dna.accentColor, dna.visualIntensity === "bold" ? 0.22 : 0.13),
    "--project-selection": rgba(dna.primaryColor, 0.3),
    "--iaura-primary-rgb": channels(iauraPrimary),
    "--iaura-secondary-rgb": channels(iauraSecondary),
    "--iaura-accent-rgb": channels(iauraAccent),
    "--iaura-stage": mix(surface, iauraPrimary, strength * 0.42),
    "--iaura-message-user": mix(elevated, dna.primaryColor, strength * 1.2),
    "--iaura-message-assistant": mix(elevated, iauraPrimary, strength * 0.52),
    "--iaura-glow-alpha": dna.visualIntensity === "subtle" ? "0.18" : dna.visualIntensity === "bold" ? "0.38" : "0.27",
    "--iaura-ring-alpha": dna.visualIntensity === "subtle" ? "0.16" : dna.visualIntensity === "bold" ? "0.34" : "0.24",
    "--iaura-particle-opacity": dna.visualIntensity === "subtle" ? "0.58" : dna.visualIntensity === "bold" ? "1" : "0.8",
    "--iaura-surface-depth": dna.visualIntensity === "subtle" ? "12px" : dna.visualIntensity === "bold" ? "30px" : "20px",
    "--iaura-rich-dark-surface": richDarkSurface,
    "--iaura-rich-dark-elevated": richDarkElevated,
    "--iaura-rich-dark-text": richDarkText,
    "--iaura-rich-dark-secondary": readableText(richDarkText, richDarkElevated, 0.3),
    "--iaura-rich-dark-muted": readableText(richDarkText, richDarkElevated, 0.44),
    "--iaura-rich-dark-border": rgba(iauraAccent, 0.3),
    "--iaura-rich-light-surface": richLightSurface,
    "--iaura-rich-light-elevated": richLightElevated,
    "--iaura-rich-light-text": richLightText,
    "--iaura-rich-light-secondary": readableText(richLightText, richLightElevated, 0.28),
    "--iaura-rich-light-muted": readableText(richLightText, richLightElevated, 0.42),
    "--iaura-rich-light-border": rgba(dna.primaryColor, 0.3),
    "--iaura-rich-action": accessibleAction(iauraPrimary).background,
    "--iaura-rich-action-text": accessibleAction(iauraPrimary).foreground,
  }};
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveMotionSignature(projectId: string, value: unknown, reducedMotion = false): ProjectMotionSignature {
  const dna = normalizeThemeDNA(value);
  const seed = hashSeed(`${projectId}|${dna.motionStyle}|${dna.version}|${dna.primaryColor}|${dna.secondaryColor}|${dna.accentColor}`);
  const pick = (shift: number, size: number) => (seed >>> shift) % size;
  const personalities = {
    calm: { normal: 340, context: 620, distance: 8, stagger: 52, easing: "cubic-bezier(.22,.61,.36,1)" },
    fluid: { normal: 360, context: 680, distance: 12, stagger: 44, easing: "cubic-bezier(.2,.8,.2,1)" },
    dynamic: { normal: 270, context: 540, distance: 18, stagger: 34, easing: "cubic-bezier(.16,1,.3,1)" },
    precision: { normal: 240, context: 500, distance: 10, stagger: 28, easing: "cubic-bezier(.4,0,.2,1)" },
  }[dna.motionStyle];
  return {
    direction: (["left", "right", "up", "down"] as const)[pick(0, 4)],
    distance: reducedMotion ? 0 : personalities.distance + pick(3, 5),
    scale: reducedMotion ? 1 : 0.992 + pick(6, 5) / 1000,
    microDuration: reducedMotion ? 1 : 140 + pick(9, 61),
    normalDuration: reducedMotion ? 1 : personalities.normal + pick(12, 41) - 20,
    contextDuration: reducedMotion ? 1 : personalities.context + pick(15, 81) - 40,
    stagger: reducedMotion ? 0 : personalities.stagger + pick(18, 13) - 6,
    sequence: (["forward", "reverse", "center-out"] as const)[pick(21, 3)],
    easing: reducedMotion ? "linear" : personalities.easing,
    ambientX: 18 + pick(23, 65),
    ambientY: 4 + pick(25, 43),
    sweepAngle: pick(27, 2) === 0 ? 105 : 255,
  };
}

export const PROJECT_THEME_PRESETS = {
  autoSales: normalizeThemeDNA({ primaryColor: "#F97316", secondaryColor: "#123A67", accentColor: "#D83A3A", surfaceMode: "dark", visualIntensity: "bold", surfacePersonality: "crisp", motionStyle: "dynamic", presetId: "auto-sales", userLabel: "Auto Sales" }),
  wellness: normalizeThemeDNA({ primaryColor: "#B8956A", secondaryColor: "#55735B", accentColor: "#E8DCC6", surfaceMode: "light", visualIntensity: "subtle", surfacePersonality: "soft", motionStyle: "fluid", presetId: "wellness", userLabel: "Wellness" }),
  cybersecurity: normalizeThemeDNA({ primaryColor: "#12305A", secondaryColor: "#25B8D7", accentColor: "#7657D6", surfaceMode: "dark", visualIntensity: "balanced", surfacePersonality: "crisp", motionStyle: "precision", presetId: "cybersecurity", userLabel: "Cybersecurity" }),
} satisfies Record<string, ProjectThemeDNA>;
