import { describe, expect, it } from "vitest";

import {
  buildActiveProjectMemoryContext,
  buildProjectMemoryContext,
} from "@/core/context/ContextBuilder";
import { LocalProjectRepository } from "@/core/project/ProjectRepository";
import type { CreativeAssetMetadata } from "@/types/creative-studio";
import type { IAuraProject } from "@/types/project";
import { IAURA_DEVELOPMENT_CONTINUITY } from "@/core/project/IAuraContinuity";
import { DEFAULT_MEMORY } from "@/constants/memory";
import { buildUserContext } from "@/utils/context";

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
  it("separates user project status from established product continuity", () => {
    const project: IAuraProject = {
      id: "iaura-project",
      name: "IAURA",
      description: "AI ecosystem centered on Aura",
      goal: "Connect memory and context",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      status: "planning",
      studios: { branding: false, website: false, app: true, marketing: false, documents: false },
      developmentContinuity: IAURA_DEVELOPMENT_CONTINUITY,
    };

    const context = buildProjectMemoryContext(project);

    expect(context).toContain("ESTADO DEL PROYECTO DEL USUARIO");
    expect(context).toContain("Estado: planning");
    expect(context).toContain("CONTINUIDAD ESTABLECIDA DEL PRODUCTO (v1)");
    expect(context).toContain("Entry / Homepage → Workspace → Project Workspace");
    expect(context).toContain("instead of restarting IAURA as a blank project");
  });

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

  it("reads the same active project selected by studio consumers", () => {
    window.localStorage.clear();
    const repository = new LocalProjectRepository();
    const inactive: IAuraProject = {
      id: "inactive",
      name: "Old project",
      description: "",
      goal: "Old goal",
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
    };
    const active = {
      ...inactive,
      id: "active",
      name: "Active studio project",
      goal: "SAME_ACTIVE_PROJECT_MARKER",
    };

    repository.createProject(inactive);
    repository.createProject(active);
    repository.setActiveProjectId(active.id);

    const context = buildActiveProjectMemoryContext(repository);

    expect(repository.getActiveProject()?.id).toBe("active");
    expect(context).toContain("SAME_ACTIVE_PROJECT_MARKER");
    expect(context).not.toContain("Old goal");
  });

  it("keeps an IAURA personal goal distinct from active Nova project state", () => {
    const personalContext = buildUserContext({
      ...DEFAULT_MEMORY,
      goals: ["Launch an IAURA beta"],
      habits: ["Work daily on IAURA"],
    });
    const nova: IAuraProject = {
      id: "nova",
      name: "Nova",
      description: "A separate active project",
      goal: "Validate Nova workflows",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      status: "building",
      studios: {
        branding: false,
        website: false,
        app: true,
        marketing: false,
        documents: false,
      },
    };
    const projectContext = buildProjectMemoryContext(nova);
    const combinedContext = `${personalContext}\n\n${projectContext}`;

    expect(combinedContext).toContain(
      "PERSONAL INTELLIGENCE — GLOBAL USER CONTEXT",
    );
    expect(combinedContext).toContain("Launch an IAURA beta");
    expect(combinedContext).toContain(
      "ACTIVE PROJECT INTELLIGENCE — PROJECT-SCOPED",
    );
    expect(projectContext).toContain("Nombre: Nova");
    expect(projectContext).toContain("Objetivo: Validate Nova workflows");
    expect(projectContext).not.toContain("Launch an IAURA beta");
    expect(projectContext).not.toContain(
      "CONTINUIDAD ESTABLECIDA DEL PRODUCTO",
    );
  });

  it("keeps IAURA development continuity scoped to IAURA", () => {
    const iaura: IAuraProject = {
      id: "iaura-project",
      name: "IAURA",
      description: "AI ecosystem centered on Aura",
      goal: "Connect memory and context",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      status: "building",
      studios: { branding: false, website: false, app: true, marketing: false, documents: false },
      developmentContinuity: IAURA_DEVELOPMENT_CONTINUITY,
    };
    const nova: IAuraProject = {
      ...iaura,
      id: "nova",
      name: "Nova",
      goal: "Validate Nova workflows",
      developmentContinuity: undefined,
    };

    expect(buildProjectMemoryContext(iaura)).toContain(
      "CONTINUIDAD ESTABLECIDA DEL PRODUCTO (v1)",
    );
    expect(buildProjectMemoryContext(nova)).not.toContain(
      "CONTINUIDAD ESTABLECIDA DEL PRODUCTO",
    );
  });

  it("returns no project context when no project is active without affecting personal serialization", () => {
    const repository = new LocalProjectRepository();
    repository.clearActiveProject();
    const personalContext = buildUserContext({
      ...DEFAULT_MEMORY,
      goals: ["Launch an IAURA beta"],
    });

    expect(buildActiveProjectMemoryContext(repository)).toBe("");
    expect(personalContext).toContain(
      "PERSONAL INTELLIGENCE — GLOBAL USER CONTEXT",
    );
    expect(personalContext).toContain("Launch an IAURA beta");
  });
});
