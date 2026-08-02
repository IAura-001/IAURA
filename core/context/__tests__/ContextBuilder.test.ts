import { describe, expect, it } from "vitest";

import { buildProjectMemoryContext } from "@/core/context/ContextBuilder";
import type { CreativeAssetMetadata } from "@/types/creative-studio";
import type { IAuraProject } from "@/types/project";

function asset(
  id: string,
  brandRevisionId: string,
  altText: string,
): CreativeAssetMetadata {
  return {
    id,
    projectId: "project-1",
    kind: "website-hero",
    title: id,
    status: "approved",
    blobKey: id,
    prompt: altText,
    altText,
    width: 1536,
    height: 1024,
    mimeType: "image/webp",
    byteSize: 100,
    model: "gpt-image-2",
    quality: "high",
    tier: "premium",
    experimental: false,
    requestId: `request-${id}`,
    brandRevisionId,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("Creative Studio project context", () => {
  it("exposes only the active brand revision to Aura", () => {
    const project: IAuraProject = {
      id: "project-1",
      name: "VAEORA",
      description: "Creative intelligence",
      goal: "Build a coherent brand",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      status: "building",
      studios: {
        branding: true,
        website: true,
        app: false,
        marketing: false,
        documents: false,
      },
      creativeStudio: {
        schemaVersion: 1,
        brief: {
          brandName: "VAEORA",
          audience: "Founders",
          offer: "Creative systems",
          personality: "premium",
          visualDirection: "organic light",
          constraints: "no clichés",
          locale: "es",
        },
        brandRevisionId: "revision-current",
        briefHistory: [],
        outputs: {
          "website-copy": {
            deliverable: "website-copy",
            data: { marker: "CURRENT_COPY" },
            model: "gpt-5.6-terra",
            brandRevisionId: "revision-current",
            generatedAt: "2026-08-01T00:00:00.000Z",
          },
          "social-kit": {
            deliverable: "social-kit",
            data: { marker: "STALE_COPY" },
            model: "gpt-5.6-terra",
            brandRevisionId: "revision-old",
            generatedAt: "2026-07-01T00:00:00.000Z",
          },
        },
        outputHistory: {},
        assets: [
          asset("CURRENT_ASSET", "revision-current", "CURRENT_VISUAL"),
          asset("STALE_ASSET", "revision-old", "STALE_VISUAL"),
        ],
        legacyImport: {
          brandingContent: {
            positioning: "LEGACY_POSITIONING",
          },
          launchAssetIds: [],
          sourceKeys: ["iaura-branding-project-1"],
          importedAt: "2026-07-15T00:00:00.000Z",
        },
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    };

    const context = buildProjectMemoryContext(project);

    expect(context).toContain("CURRENT_COPY");
    expect(context).toContain("CURRENT_VISUAL");
    expect(context).toContain("Branding anterior importado");
    expect(context).toContain("LEGACY_POSITIONING");
    expect(context).not.toContain("STALE_COPY");
    expect(context).not.toContain("STALE_VISUAL");
    expect(context).toContain(
      "Referencias de revisiones anteriores preservadas fuera del contexto activo: 2",
    );
  });
});
