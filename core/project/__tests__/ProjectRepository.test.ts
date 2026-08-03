import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEGACY_MEMORY_STORAGE_KEY,
  LEGACY_PROJECTS_STORAGE_KEY,
  LocalProjectRepository,
  PROJECT_STATE_STORAGE_KEY,
  PROJECT_STATE_VERSION,
} from "@/core/project/ProjectRepository";
import { ProjectStorage } from "@/core/project/ProjectStorage";
import type { IAuraProject } from "@/types/project";

function project(
  id: string,
  name: string,
  overrides: Partial<IAuraProject> = {},
): IAuraProject {
  return {
    id,
    name,
    description: "Description",
    goal: "Goal",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    status: "building",
    kind: "business",
    studios: {
      branding: true,
      website: true,
      app: false,
      marketing: true,
      documents: true,
    },
    ...overrides,
  };
}

describe("LocalProjectRepository migration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("migrates legacy projects and the legacy active project without losing metadata", () => {
    const stored = project("project-1", "VAEORA", {
      creativeStudio: {
        schemaVersion: 1,
        brief: {
          brandName: "VAEORA",
          audience: "Founders",
          offer: "Creative intelligence",
          personality: "premium",
          visualDirection: "organic light",
          constraints: "no clichés",
          locale: "es",
        },
        brandRevisionId: "revision-1",
        briefHistory: [],
        outputs: {},
        outputHistory: {},
        assets: [],
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    });
    const active = project("project-2", "Mita", {
      launchStudio: {
        assets: [],
        updatedAt: "2026-08-02T00:00:00.000Z",
      },
    });
    const legacyWithUnknownMetadata = {
      ...stored,
      externalReference: "preserve-me",
    };

    window.localStorage.setItem(
      LEGACY_PROJECTS_STORAGE_KEY,
      JSON.stringify([legacyWithUnknownMetadata]),
    );
    window.localStorage.setItem(
      LEGACY_MEMORY_STORAGE_KEY,
      JSON.stringify({
        activeProject: active,
        projects: ["Mita", "Earlier project"],
      }),
    );

    const repository = new LocalProjectRepository();

    expect(repository.getProjects()).toHaveLength(3);
    expect(repository.getActiveProject()?.id).toBe("project-2");
    expect(repository.getProject("project-1")?.creativeStudio).toBeDefined();
    expect(repository.findEquivalentProject("Earlier project")).not.toBeNull();
    expect(
      repository.getProject("project-1") as IAuraProject & {
        externalReference?: string;
      },
    ).toMatchObject({ externalReference: "preserve-me" });
    expect(window.localStorage.getItem(LEGACY_PROJECTS_STORAGE_KEY)).not.toBeNull();
  });

  it("is idempotent and persists one active project", () => {
    const legacy = project("project-1", "VAEORA");
    window.localStorage.setItem(
      LEGACY_PROJECTS_STORAGE_KEY,
      JSON.stringify([legacy, { ...legacy, id: "duplicate-id" }]),
    );

    const first = new LocalProjectRepository();
    const second = new LocalProjectRepository();
    const stored = JSON.parse(
      window.localStorage.getItem(PROJECT_STATE_STORAGE_KEY) ?? "{}",
    ) as { schemaVersion: number; activeProjectId: string; projects: unknown[] };

    expect(first.getProjects()).toHaveLength(1);
    expect(second.getProjects()).toHaveLength(1);
    expect(stored.schemaVersion).toBe(PROJECT_STATE_VERSION);
    expect(stored.activeProjectId).toBe("project-1");
    expect(stored.projects).toHaveLength(1);
  });

  it("initializes safely from empty or corrupted storage", () => {
    expect(new LocalProjectRepository().getSnapshot()).toMatchObject({
      activeProjectId: null,
      projects: [],
    });

    window.localStorage.setItem(PROJECT_STATE_STORAGE_KEY, "{invalid");
    window.localStorage.setItem(LEGACY_PROJECTS_STORAGE_KEY, "not-json");
    window.localStorage.setItem(LEGACY_MEMORY_STORAGE_KEY, "[]");

    expect(() => new LocalProjectRepository()).not.toThrow();
    expect(new LocalProjectRepository().getProjects()).toEqual([]);
  });

  it("normalizes partially missing legacy fields without dropping the project", () => {
    window.localStorage.setItem(
      LEGACY_PROJECTS_STORAGE_KEY,
      JSON.stringify([{ id: "partial-1", name: "Partial project" }]),
    );

    const repository = new LocalProjectRepository();

    expect(repository.getProject("partial-1")).toMatchObject({
      description: "",
      goal: "",
      status: "planning",
      kind: "general",
      studios: {
        branding: false,
        website: false,
      },
    });
  });

  it("deduplicates an already-versioned snapshot and remaps its active id", () => {
    const first = project("project-1", "VAEORA");
    const duplicate = project("project-2", "  vaeora  ");
    window.localStorage.setItem(
      PROJECT_STATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        activeProjectId: "project-2",
        projects: [first, duplicate],
      }),
    );

    const repository = new LocalProjectRepository();

    expect(repository.getProjects()).toHaveLength(1);
    expect(repository.getActiveProject()?.id).toBe("project-1");
  });

  it("keeps legacy data recoverable when the canonical migration write fails", () => {
    const legacy = project("project-1", "VAEORA");
    const serializedLegacy = JSON.stringify([legacy]);
    window.localStorage.setItem(
      LEGACY_PROJECTS_STORAGE_KEY,
      serializedLegacy,
    );
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation((key) => {
        if (key === PROJECT_STATE_STORAGE_KEY) {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
      });

    const failedMigration = new LocalProjectRepository();

    expect(failedMigration.getProjects()).toHaveLength(1);
    expect(window.localStorage.getItem(PROJECT_STATE_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_PROJECTS_STORAGE_KEY)).toBe(
      serializedLegacy,
    );

    setItem.mockRestore();
    expect(new LocalProjectRepository().getProjects()).toHaveLength(1);
    expect(window.localStorage.getItem(PROJECT_STATE_STORAGE_KEY)).not.toBeNull();
  });

  it("prevents equivalent duplicate projects and preserves the active id", () => {
    const repository = new LocalProjectRepository();
    const first = repository.createProject(project("project-1", "VAEORA"));
    const duplicate = repository.createProject(
      project("project-2", "  vaeora  "),
    );

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.project.id).toBe("project-1");
    expect(repository.getProjects()).toHaveLength(1);
    expect(repository.getActiveProject()?.id).toBe("project-1");
  });

  it("keeps the legacy ProjectStorage API on the authoritative repository", () => {
    const repository = new LocalProjectRepository();
    const storage = new ProjectStorage(repository);
    const legacyProject = project("legacy-1", "Legacy API");

    expect(storage.save([legacyProject])).toBe(true);
    expect(storage.load()).toEqual([legacyProject]);
    expect(repository.getActiveProject()?.id).toBe("legacy-1");
  });
});
