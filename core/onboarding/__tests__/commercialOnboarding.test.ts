import { describe, expect, it } from "vitest";
import { commercialNextAction, normalizeLaunchIntent, provisionalLaunchName,
  shouldEnterCommercialOnboarding } from "../commercialOnboarding";
import type { IAuraProject } from "@/types/project";
import { ProjectEngine } from "@/core/project/ProjectEngine";
import { LocalProjectRepository } from "@/core/project/ProjectRepository";

const project = (overrides: Partial<IAuraProject> = {}): IAuraProject => ({
  id: "p1", name: "Launch", description: "", goal: "Launch something useful",
  createdAt: "2026-01-01", updatedAt: "2026-01-01", status: "planning", kind: "business",
  studios: { branding: true, website: true, app: false, marketing: true, documents: true },
  ...overrides,
});

describe("commercial onboarding decisions", () => {
  it("accepts meaningful free-form intent and rejects empty or trivial input", () => {
    expect(normalizeLaunchIntent("   ")).toBeNull();
    expect(normalizeLaunchIntent("launch it")).toBeNull();
    expect(normalizeLaunchIntent("  I want to launch a premium skincare brand.  "))
      .toBe("I want to launch a premium skincare brand.");
  });

  it("uses an explicit name and otherwise creates a safe provisional name", () => {
    expect(provisionalLaunchName("I want to launch a skincare brand called Luma"))
      .toBe("Luma");
    expect(provisionalLaunchName("I want to turn my cybersecurity experience into a paid consulting offer."))
      .toBe("Cybersecurity Consulting Launch");
  });

  it("only enters first-launch onboarding for a new user with no projects", () => {
    expect(shouldEnterCommercialOnboarding(false, [])).toBe(true);
    expect(shouldEnterCommercialOnboarding(true, [])).toBe(false);
    expect(shouldEnterCommercialOnboarding(false, [project()])).toBe(false);
  });

  it("selects one next best action from durable project facts", () => {
    expect(commercialNextAction(project())).toBe("continue-with-aura");
    expect(commercialNextAction(project({ description: "Saved" }))).toBe("build-brand-system");
    expect(commercialNextAction(project({ description: "Saved", branding: {
      brandName: "A", slogan: "", mission: "", personality: ["premium"], typography: "modern",
      palette: { primary: "#000", secondary: "#111", accent: "#222", background: "#fff", text: "#000" },
      logo: { symbol: "spark", container: "circle", weight: "regular" }, updatedAt: "2026-01-01",
    } }))).toBe("approve-first-visual");
  });

  it("creates a real project without fabricating Theme DNA", () => {
    const engine = new ProjectEngine(new LocalProjectRepository({ synchronize: false, writerId: "onboarding-test" }));
    const created = engine.createProject({ name: "Skincare Launch", goal: "Launch skincare",
      kind: "business", createdAt: "2026-01-01T00:00:00Z",
      commercialOnboarding: { version: 1, source: "first-launch" } });
    expect(created).toMatchObject({ name: "Skincare Launch", goal: "Launch skincare",
      commercialOnboarding: { source: "first-launch" } });
    expect(created.themeDNA).toBeUndefined();
  });
});
