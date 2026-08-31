import { describe, expect, it } from "vitest";
import { normalizeProductFunnelEvent, persistedLaunchMilestones, retentionFlags } from "../funnel";
import type { IAuraProject } from "@/types/project";

const project = (overrides: Partial<IAuraProject> = {}): IAuraProject => ({
  id: "project-a", name: "A", description: "", goal: "", createdAt: "2026-01-01",
  updatedAt: "2026-01-01", status: "planning",
  studios: { branding: false, website: false, app: false, marketing: false, documents: false },
  ...overrides,
});

describe("product funnel contracts", () => {
  it("accepts only allowlisted metadata and never copies arbitrary content", () => {
    expect(normalizeProductFunnelEvent({
      schemaVersion: 1,
      sessionId: "123e4567-e89b-42d3-a456-426614174000",
      source: "presence", inputMode: "voice", prompt: "private idea",
    })).toEqual({
      sessionId: "123e4567-e89b-42d3-a456-426614174000",
      eventKey: null, source: "presence", metadata: { input_mode: "voice" },
    });
  });

  it("rejects unknown schema versions", () => {
    expect(normalizeProductFunnelEvent({ schemaVersion: 2 })).toBeNull();
  });

  it("only qualifies persisted launch artifacts", () => {
    expect(persistedLaunchMilestones(project())).toEqual([]);
    expect(persistedLaunchMilestones(project({
      themeDNA: { version: 1, source: "canonical", seed: "a", signature: "a", generatedAt: "2026-01-01", tokens: {} } as never,
      launchStudio: { updatedAt: "2026-01-01", assets: [{
        id: "a", title: "Launch", type: "Announcement", status: "approved",
        content: "persisted", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      }] },
    }))).toEqual(["brand_system", "launch_material"]);
  });

  it("defines D1 as next calendar day and D7 as days 6 through 8", () => {
    expect(retentionFlags("2026-01-10T23:59:00Z", ["2026-01-11", "2026-01-18"]))
      .toEqual({ d1: true, d7: true });
    expect(retentionFlags("2026-01-10T12:00:00Z", ["2026-01-10", "2026-01-15"]))
      .toEqual({ d1: false, d7: false });
  });
});
