import { describe, expect, it } from "vitest";

import { mergeProjectSnapshots } from "@/core/project/mergeProjectSnapshots";
import type { IAuraProject } from "@/types/project";

function project(overrides: Partial<IAuraProject>): IAuraProject {
  return {
    id: "project-1",
    name: "VAEORA",
    description: "",
    goal: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "planning",
    studios: {
      branding: false,
      website: false,
      app: false,
      marketing: false,
      documents: false,
    },
    ...overrides,
  };
}

describe("mergeProjectSnapshots", () => {
  it("uses the newest project fields while preserving capabilities from both stores", () => {
    const stored = project({
      name: "Old name",
      studios: {
        branding: false,
        website: true,
        app: false,
        marketing: false,
        documents: true,
      },
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
    const iaura = project({
      name: "Current name",
      studios: {
        branding: true,
        website: false,
        app: false,
        marketing: true,
        documents: false,
      },
      updatedAt: "2026-08-01T00:00:00.000Z",
    });

    const merged = mergeProjectSnapshots(stored, iaura);

    expect(merged.name).toBe("Current name");
    expect(merged.studios).toEqual({
      branding: true,
      website: true,
      app: false,
      marketing: true,
      documents: true,
    });
  });

  it("keeps the newest nested studio memory even when the other project is newer", () => {
    const stored = project({
      updatedAt: "2026-08-01T00:00:00.000Z",
      brandingStudio: {
        prompts: {},
        generatedContent: { positioning: "Stored" },
        updatedAt: "2026-08-02T00:00:00.000Z",
      },
    });
    const iaura = project({
      updatedAt: "2026-08-03T00:00:00.000Z",
      brandingStudio: {
        prompts: {},
        generatedContent: { positioning: "IAURA" },
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    expect(
      mergeProjectSnapshots(stored, iaura).brandingStudio?.generatedContent,
    ).toEqual({ positioning: "Stored" });
  });
});
