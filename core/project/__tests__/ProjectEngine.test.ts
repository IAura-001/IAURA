import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectEngine } from "@/core/project/ProjectEngine";
import type { CreativeStudioMemory } from "@/types/creative-studio";

function createCreativeMemory(
  outputs: CreativeStudioMemory["outputs"] = {},
): CreativeStudioMemory {
  return {
    schemaVersion: 1,
    brief: {
      brandName: "VAEORA",
      audience: "Creative founders",
      offer: "Intelligent brand systems",
      personality: "premium, intelligent",
      visualDirection: "Organic luminous structures",
      constraints: "No generic sci-fi",
      locale: "es",
    },
    brandRevisionId: "revision-1",
    briefHistory: [],
    outputs,
    outputHistory: {},
    assets: [],
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("ProjectEngine creative studio integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("activates creative capabilities without disabling existing studios", () => {
    const engine = new ProjectEngine();
    const project = engine.createProject({ name: "VAEORA" });
    engine.updateProject(project.id, {
      studios: { website: true, marketing: true, documents: true },
    });

    const updated = engine.updateCreativeStudio(
      project.id,
      createCreativeMemory(),
    );

    expect(updated.studios).toMatchObject({
      branding: true,
      website: true,
      marketing: true,
      documents: true,
    });
  });

  it("activates website and marketing when their systems are generated", () => {
    const engine = new ProjectEngine();
    const project = engine.createProject({ name: "VAEORA" });

    const updated = engine.updateCreativeStudio(
      project.id,
      createCreativeMemory({
        "website-copy": {
          deliverable: "website-copy",
          data: {},
          model: "gpt-5.6-terra",
          brandRevisionId: "revision-1",
          generatedAt: "2026-08-01T00:00:00.000Z",
        },
        "social-kit": {
          deliverable: "social-kit",
          data: {},
          model: "gpt-5.6-terra",
          brandRevisionId: "revision-1",
          generatedAt: "2026-08-01T00:00:00.000Z",
        },
      }),
    );

    expect(updated.studios.website).toBe(true);
    expect(updated.studios.marketing).toBe(true);
  });

  it("preserves the prior repository state and exposes a failed persistence write", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });
    const engine = new ProjectEngine();

    const project = engine.createProject({ name: "Session-only brand" });

    expect(project.name).toBe("Session-only brand");
    expect(engine.getCurrentProject()).toBeNull();
    expect(engine.didLastPersistenceSucceed()).toBe(false);
    setItem.mockRestore();
  });

  it("starts safely when browser storage reads are blocked", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("Storage blocked", "SecurityError");
      });

    expect(() => new ProjectEngine()).not.toThrow();
    getItem.mockRestore();
  });
});
