import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_THEME_DNA,
  PROJECT_THEME_PRESETS,
  contrastRatio,
  normalizeThemeDNA,
  readableForeground,
  resolveMotionSignature,
  resolveProjectTheme,
} from "../themeDNA";

describe("project Theme DNA", () => {
  it("normalizes colors, enums, labels, and unknown versions", () => {
    expect(normalizeThemeDNA({ primaryColor: "#abc", surfaceMode: "unsafe", userLabel: " x " })).toMatchObject({
      version: 1,
      primaryColor: "#AABBCC",
      surfaceMode: "dark",
      userLabel: "x",
    });
  });

  it("falls back safely for invalid and executable-looking color values", () => {
    const resolved = resolveProjectTheme({ primaryColor: "javascript:alert(1)", accentColor: "transparent" });
    expect(resolved.dna.primaryColor).toBe(DEFAULT_PROJECT_THEME_DNA.primaryColor);
    expect(resolved.dna.accentColor).toBe(DEFAULT_PROJECT_THEME_DNA.accentColor);
    expect(resolved.tokens["--project-action"]).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("chooses readable action foregrounds", () => {
    expect(readableForeground("#050505")).toBe("#FFFFFF");
    expect(readableForeground("#FAFAFA")).toBe("#11131A");
  });

  it("resolves stable but project-distinct motion signatures", () => {
    const dna = normalizeThemeDNA({ motionStyle: "dynamic", primaryColor: "#F97316" });
    expect(resolveMotionSignature("project-a", dna)).toEqual(resolveMotionSignature("project-a", dna));
    expect(resolveMotionSignature("project-a", dna)).not.toEqual(resolveMotionSignature("project-b", dna));
  });

  it("removes transforms, stagger, and routine durations for reduced motion", () => {
    expect(resolveMotionSignature("project-a", {}, true)).toMatchObject({ distance: 0, scale: 1, stagger: 0, normalDuration: 1, contextDuration: 1 });
  });

  it("does not carry Theme DNA between independent resolutions", () => {
    const a = resolveProjectTheme({ primaryColor: "#FF5500" });
    const b = resolveProjectTheme(undefined);
    expect(a.tokens["--project-primary"]).toBe("#FF5500");
    expect(b.tokens["--project-primary"]).toBe(DEFAULT_PROJECT_THEME_DNA.primaryColor);
  });

  it.each([
    "", "   ", "#1234", "#12345", "#1234567", "#12345678",
    "transparent", "url(https://example.com/x)", "red; background:url(x)", "#" + "A".repeat(10_000),
  ])("rejects hostile or unsupported color input %s", (primaryColor) => {
    expect(normalizeThemeDNA({ primaryColor }).primaryColor).toBe(DEFAULT_PROJECT_THEME_DNA.primaryColor);
  });

  it("normalizes invalid enums and partial Theme DNA", () => {
    expect(normalizeThemeDNA({ surfaceMode: "neon", visualIntensity: 10, surfacePersonality: "liquid", motionStyle: "bounce" })).toMatchObject(DEFAULT_PROJECT_THEME_DNA);
  });

  it("accepts the legacy motionPersonality field", () => {
    expect(normalizeThemeDNA({ motionPersonality: "precision" }).motionStyle).toBe("precision");
  });

  it("fails closed for an unknown future Theme DNA version", () => {
    expect(normalizeThemeDNA({ version: 999, primaryColor: "#FF0000", motionStyle: "dynamic" })).toEqual(DEFAULT_PROJECT_THEME_DNA);
  });

  it("keeps primary and muted text readable in dark and light environments", () => {
    for (const theme of [undefined, { surfaceMode: "light" }]) {
      const { tokens } = resolveProjectTheme(theme);
      expect(contrastRatio(tokens["--project-text"], tokens["--project-bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens["--project-text-muted"], tokens["--project-bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens["--project-action-text"], tokens["--project-action"])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps every functional text role readable on its actual light surfaces", () => {
    const { tokens } = resolveProjectTheme({ ...PROJECT_THEME_PRESETS.wellness, surfaceMode: "light" });
    for (const role of ["--project-text", "--project-text-secondary", "--project-text-muted", "--project-metadata", "--project-placeholder"] as const) {
      expect(contrastRatio(tokens[role], tokens["--project-surface"]), role).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens[role], tokens["--project-surface-elevated"]), role).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(tokens["--project-link"], tokens["--project-surface"])).toBeGreaterThanOrEqual(4.5);
  });

  it("derives contextual IAURA from palette and intensity while preserving a canonical blend", () => {
    const subtle = resolveProjectTheme({ ...PROJECT_THEME_PRESETS.wellness, visualIntensity: "subtle" }).tokens;
    const balanced = resolveProjectTheme({ ...PROJECT_THEME_PRESETS.wellness, visualIntensity: "balanced" }).tokens;
    const bold = resolveProjectTheme({ ...PROJECT_THEME_PRESETS.wellness, visualIntensity: "bold" }).tokens;
    expect(subtle["--iaura-primary-rgb"]).not.toBe(balanced["--iaura-primary-rgb"]);
    expect(balanced["--iaura-primary-rgb"]).not.toBe(bold["--iaura-primary-rgb"]);
    expect(Number(subtle["--iaura-glow-alpha"])).toBeLessThan(Number(bold["--iaura-glow-alpha"]));
    expect(resolveProjectTheme(undefined).tokens["--iaura-primary-rgb"]).toBeTruthy();
  });

  it("does not use fixture names, labels, preset ids, or project categories in resolution", () => {
    const palette = { primaryColor: "#345678", secondaryColor: "#789ABC", accentColor: "#C084FC", surfaceMode: "light" as const };
    const a = resolveProjectTheme({ ...palette, presetId: "cars", userLabel: "Auto Sales", kind: "business" }).tokens;
    const b = resolveProjectTheme({ ...palette, presetId: "anything", userLabel: "My Garden", kind: "wellness" }).tokens;
    expect(a).toEqual(b);
  });

  it.each(Object.entries(PROJECT_THEME_PRESETS))("keeps %s nested dark and light IAURA roles surface-safe", (_name, dna) => {
    const { tokens } = resolveProjectTheme(dna);
    for (const tone of ["dark", "light"] as const) {
      const surface = tokens[`--iaura-rich-${tone}-elevated`];
      for (const role of ["text", "secondary", "muted"] as const) {
        expect(contrastRatio(tokens[`--iaura-rich-${tone}-${role}`], surface), `${tone}-${role}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrastRatio(tokens["--iaura-rich-action-text"], tokens["--iaura-rich-action"])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(PROJECT_THEME_PRESETS))("keeps %s secondary-card links and descriptions readable", (_name, dna) => {
    const { tokens } = resolveProjectTheme(dna);
    expect(contrastRatio(tokens["--project-link"], tokens["--project-surface"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens["--project-text-secondary"], tokens["--project-surface"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens["--project-metadata"], tokens["--project-surface"])).toBeGreaterThanOrEqual(4.5);
  });
});
