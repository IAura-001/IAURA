import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveCreativeImagePreset,
} from "../presets";
import {
  readCreativeImageResponseMetadata,
  validateCreativeCopyContent,
  validateCreativeCopyRequest,
  validateCreativeImageRequest,
} from "../validation";

const brand = {
  name: "VAEORA",
  slogan: "Where intelligence takes shape.",
  mission: "Make intelligent creation feel coherent and alive.",
  personality: ["premium", "organic", "intelligent"],
  palette: {
    primary: "#6D4AFF",
    secondary: "#2434A8",
    accent: "#A89BFF",
    background: "#050509",
    text: "#F5F4FA",
  },
};

describe("creative request validation", () => {
  it("normalizes a valid copy request", () => {
    const result = validateCreativeCopyRequest({
      projectId: "project-1",
      deliverable: "website-copy",
      locale: "es",
      brief: "  Construye una narrativa editorial precisa.  ",
      brand: {
        ...brand,
        palette: {
          ...brand.palette,
          primary: "#6d4aff",
        },
      },
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.brief).toBe(
        "Construye una narrativa editorial precisa.",
      );
      expect(result.data.brand.palette?.primary).toBe("#6D4AFF");
    }
  });

  it.each(["es", "en", "pt", "fr"] as const)(
    "accepts the supported creative locale %s",
    (locale) => {
      const result = validateCreativeCopyRequest({
        projectId: "project-1",
        deliverable: "brand-foundation",
        locale,
        brief: "Build a coherent brand system.",
        brand,
      });

      expect(result.success).toBe(true);
    },
  );

  it("rejects oversized briefs and unknown request fields", () => {
    const oversized = validateCreativeCopyRequest({
      projectId: "project-1",
      deliverable: "website-copy",
      locale: "es",
      brief: "x".repeat(4_001),
      brand,
    });
    const unknownField = validateCreativeCopyRequest({
      projectId: "project-1",
      deliverable: "website-copy",
      locale: "es",
      brief: "A valid brief.",
      brand,
      model: "client-controlled-model",
    });

    expect(oversized.success).toBe(false);
    expect(unknownField.success).toBe(false);
  });

  it("enforces logo and explicit ultra preset constraints", () => {
    const invalidLogo = validateCreativeImageRequest({
      projectId: "project-1",
      intent: "logo-mark",
      aspect: "landscape",
      tier: "premium",
      brief: "An abstract mark.",
      brand,
    });
    const invalidUltra = validateCreativeImageRequest({
      projectId: "project-1",
      intent: "editorial-photo",
      aspect: "portrait",
      tier: "ultra",
      brief: "A premium editorial portrait.",
      brand,
    });

    expect(invalidLogo).toEqual({
      success: false,
      error: {
        code: "VAEORA_UNSUPPORTED_PRESET",
        message: "Logo marks require the square aspect preset.",
      },
    });
    expect(invalidUltra).toEqual({
      success: false,
      error: {
        code: "VAEORA_UNSUPPORTED_PRESET",
        message:
          "Ultra generation is available only for landscape and hero assets.",
      },
    });
  });

  it("accepts a bounded operation ID and rejects unsafe identifiers", () => {
    const accepted = validateCreativeImageRequest({
      projectId: "project-1",
      intent: "website-hero",
      aspect: "hero",
      tier: "premium",
      brief: "An atmospheric hero visual.",
      brand,
      operationId: "brand-kit-run_01.website-hero",
    });
    const rejected = validateCreativeImageRequest({
      projectId: "project-1",
      intent: "website-hero",
      aspect: "hero",
      tier: "premium",
      brief: "An atmospheric hero visual.",
      brand,
      operationId: "brand kit with spaces",
    });

    expect(accepted).toMatchObject({
      success: true,
      data: { operationId: "brand-kit-run_01.website-hero" },
    });
    expect(rejected).toMatchObject({
      success: false,
      error: { code: "VAEORA_INVALID_REQUEST" },
    });
  });

  it("resolves ultra as the explicit experimental 4K preset", () => {
    const request = validateCreativeImageRequest({
      projectId: "project-1",
      intent: "website-hero",
      aspect: "hero",
      tier: "ultra",
      brief: "An atmospheric hero visual.",
      brand,
    });

    expect(request.success).toBe(true);

    if (request.success) {
      expect(resolveCreativeImagePreset(request.data)).toMatchObject({
        size: "3840x2160",
        width: 3840,
        height: 2160,
        experimental: true,
        background: "opaque",
      });
    }
  });

  it("uses a native 16:9 hero and a genuinely low-cost draft tier", () => {
    expect(
      resolveCreativeImagePreset({
        projectId: "project-1",
        intent: "website-hero",
        aspect: "hero",
        tier: "draft",
        brief: "A restrained hero field.",
        brand,
      }),
    ).toMatchObject({
      size: "1536x864",
      width: 1536,
      height: 864,
      quality: "low",
      experimental: false,
    });
  });

  it("parses provenance from a binary image response", () => {
    const response = new Response(new ArrayBuffer(0), {
      headers: {
        "Content-Type": "image/webp",
        "X-Request-Id": "request-1",
        "X-Vaeora-Asset-Id":
          "asset_123e4567-e89b-12d3-a456-426614174000",
        "X-Vaeora-Image-Width": "1536",
        "X-Vaeora-Image-Height": "1024",
        "X-Vaeora-Image-Experimental": "false",
        "X-Vaeora-Model": "gpt-image-2",
        "X-Vaeora-Created-At": "2026-08-01T12:00:00.000Z",
      },
    });
    const result = readCreativeImageResponseMetadata(response);

    expect(result).toEqual({
      success: true,
      data: {
        requestId: "request-1",
        assetId: "asset_123e4567-e89b-12d3-a456-426614174000",
        width: 1536,
        height: 1024,
        experimental: false,
        mimeType: "image/webp",
        model: "gpt-image-2",
        createdAt: "2026-08-01T12:00:00.000Z",
      },
    });
  });
});

describe("creative structured output validation", () => {
  it("accepts a strict website copy result", () => {
    const result = validateCreativeCopyContent("website-copy", {
      seo: {
        title: "VAEORA — Intelligent creation",
        description: "A coherent creative intelligence for modern brands.",
        keywords: ["creative intelligence", "branding", "web design"],
      },
      hero: {
        eyebrow: "Coming into focus",
        title: "Where intelligence takes shape.",
        subtitle: "Build a brand system that thinks as one.",
        primaryCta: "Begin",
        secondaryCta: "Explore",
      },
      sections: [
        {
          id: "strategy",
          title: "One coherent direction",
          body: "Move from intention to a precise brand foundation.",
          cta: "Define it",
        },
        {
          id: "identity",
          title: "A living identity",
          body: "Develop visuals and language from the same intelligence.",
          cta: "Shape it",
        },
        {
          id: "launch",
          title: "Ready for the world",
          body: "Turn the system into launch-ready content.",
          cta: "Launch it",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects extra generated fields", () => {
    const result = validateCreativeCopyContent("social-kit", {
      bio: "Creative intelligence taking shape.",
      launchCaption: "A new field is forming.",
      contentPillars: ["Intelligence", "Identity", "Creation"],
      postIdeas: [
        { title: "One", hook: "Hook", caption: "Caption" },
        { title: "Two", hook: "Hook", caption: "Caption" },
        { title: "Three", hook: "Hook", caption: "Caption" },
      ],
      unsafeHtml: "<script />",
    });

    expect(result.success).toBe(false);
  });
});
