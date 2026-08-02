import {
  loadCreativeStudioMemory,
  reviseCreativeBrief,
} from "@/core/creativeStudio/memory";
import type { IAuraProject } from "@/types/project";
import { describe, expect, it, vi } from "vitest";

function createProject(): IAuraProject {
  return {
    id: "project-1",
    name: "VAEORA",
    description: "An intelligent creative system.",
    goal: "Build a premium identity.",
    status: "planning",
    studios: {
      branding: false,
      website: false,
      app: false,
      marketing: false,
      documents: false,
    },
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    branding: {
      brandName: "VAEORA",
      slogan: "Where intelligence takes shape.",
      mission: "Give intelligence a meaningful form.",
      personality: ["premium", "serene"],
      typography: "modern",
      palette: {
        primary: "#6D5CE7",
        secondary: "#334FC6",
        accent: "#A89CFF",
        background: "#050509",
        text: "#F4F2F8",
      },
      logo: {
        symbol: "spark",
        container: "none",
        weight: "light",
      },
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
  };
}

function createStorage(entries: Record<string, string>): Storage {
  const values = new Map(Object.entries(entries));

  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

describe("creative studio memory", () => {
  it("starts from the existing brand profile without replacing it", () => {
    const project = createProject();
    const memory = loadCreativeStudioMemory(project);

    expect(memory.brief.brandName).toBe("VAEORA");
    expect(memory.brief.personality).toBe("premium, serene");
    expect(project.branding?.slogan).toBe("Where intelligence takes shape.");
    expect(memory.schemaVersion).toBe(1);
  });

  it.each([
    ["es-419", "es"],
    ["en-US", "en"],
    ["pt-BR", "pt"],
    ["fr-FR", "fr"],
  ] as const)(
    "starts new creative work in the IAURA locale %s",
    (preferredLocale, creativeLocale) => {
      const memory = loadCreativeStudioMemory(
        createProject(),
        undefined,
        preferredLocale,
      );

      expect(memory.brief.locale).toBe(creativeLocale);
    },
  );

  it("imports legacy drafts additively and never removes their keys", () => {
    const project = createProject();
    const brandingKey = `iaura.branding-studio.v1.${project.id}`;
    const launchKey = `iaura.launch-studio.v1.${project.id}`;
    const storage = createStorage({
      [brandingKey]: JSON.stringify({
        generatedContent: {
          naming: "VAEORA naming direction",
          mission: "Shape useful intelligence",
        },
      }),
      [launchKey]: JSON.stringify({
        assets: [{ id: "launch-1" }],
      }),
    });

    const memory = loadCreativeStudioMemory(project, storage);

    expect(memory.legacyImport?.brandingContent.naming).toBe(
      "VAEORA naming direction",
    );
    expect(memory.legacyImport?.launchAssetIds).toContain("launch-1");
    expect(memory.legacyImport?.sourceKeys).toEqual(
      expect.arrayContaining([brandingKey, launchKey]),
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("opens a new revision only when the direction changes", () => {
    const memory = loadCreativeStudioMemory(createProject());
    const unchanged = reviseCreativeBrief(memory, memory.brief);
    const changed = reviseCreativeBrief(memory, {
      ...memory.brief,
      audience: "Independent creative founders",
    });

    expect(unchanged.brandRevisionId).toBe(memory.brandRevisionId);
    expect(changed.brandRevisionId).not.toBe(memory.brandRevisionId);
    expect(changed.briefHistory.map((revision) => revision.id)).toEqual(
      expect.arrayContaining([
        memory.brandRevisionId,
        changed.brandRevisionId,
      ]),
    );
    expect(changed.assets).toEqual(memory.assets);
  });

  it("recovers safely from a malformed stored studio", () => {
    const project = createProject();
    project.creativeStudio = {
      schemaVersion: 1,
      brief: "broken",
      brandRevisionId: "",
      briefHistory: "broken",
      outputs: { "website-copy": "broken" },
      outputHistory: { "website-copy": [null, "broken"] },
      assets: [{ id: "missing-required-fields" }],
      updatedAt: "",
    } as unknown as IAuraProject["creativeStudio"];

    const memory = loadCreativeStudioMemory(project);

    expect(memory.brief.brandName).toBe("VAEORA");
    expect(memory.assets).toEqual([]);
    expect(memory.outputs).toEqual({});
    expect(memory.briefHistory[0]?.id).toBe(memory.brandRevisionId);
  });

  it("migrates an existing output into append-only history", () => {
    const project = createProject();
    const generatedAt = "2026-08-01T12:00:00.000Z";
    const seed = loadCreativeStudioMemory(project);
    project.creativeStudio = {
      ...seed,
      outputHistory: {},
      outputs: {
        "website-copy": {
          deliverable: "website-copy",
          data: { hero: { title: "Intelligence, shaped." } },
          model: "gpt-5.6-terra",
          brandRevisionId: seed.brandRevisionId,
          generatedAt,
        },
      },
    };

    const migrated = loadCreativeStudioMemory(project);

    expect(migrated.outputHistory["website-copy"]).toHaveLength(1);
    expect(
      migrated.outputHistory["website-copy"]?.[0]?.generatedAt,
    ).toBe(generatedAt);
  });
});
