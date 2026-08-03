import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MEMORY } from "@/constants/memory";
import {
  LEGACY_MEMORY_STORAGE_KEY,
  LocalMemoryRepository,
  MEMORY_STATE_STORAGE_KEY,
} from "@/core/memory/MemoryRepository";
import { LocalProjectRepository } from "@/core/project/ProjectRepository";
import type { IAuraProject } from "@/types/project";

const activeProject: IAuraProject = {
  id: "project-1",
  name: "VAEORA",
  description: "Creative intelligence",
  goal: "Ship the ecosystem",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  status: "building",
  studios: {
    branding: true,
    website: true,
    app: false,
    marketing: true,
    documents: true,
  },
};

describe("LocalMemoryRepository", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("migrates structured legacy memory and shares its active project", () => {
    window.localStorage.setItem(
      LEGACY_MEMORY_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_MEMORY,
        goals: ["Launch VAEORA"],
        habits: ["Review roadmap"],
        activeProject,
      }),
    );
    const projects = new LocalProjectRepository();
    const memories = new LocalMemoryRepository(projects);

    expect(memories.getMemory()).toMatchObject({
      goals: ["Launch VAEORA"],
      habits: ["Review roadmap"],
      activeProject: { id: "project-1" },
    });
    expect(projects.getActiveProject()?.id).toBe("project-1");
    expect(window.localStorage.getItem(MEMORY_STATE_STORAGE_KEY)).not.toBeNull();
  });

  it("fails safely when stored memory is partially corrupted", () => {
    window.localStorage.setItem(
      MEMORY_STATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        memory: { goals: "invalid", habits: [1, "Valid habit"] },
        entries: [{ invalid: true }],
      }),
    );

    const memories = new LocalMemoryRepository(
      new LocalProjectRepository(),
    );

    expect(memories.getMemory().goals).toEqual([]);
    expect(memories.getMemory().habits).toEqual(["Valid habit"]);
    expect(memories.getEntries()).toEqual([]);
  });

  it("ignores an incomplete legacy active project safely", () => {
    window.localStorage.setItem(
      LEGACY_MEMORY_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_MEMORY,
        activeProject: { id: "missing-name" },
      }),
    );

    const memories = new LocalMemoryRepository(
      new LocalProjectRepository(),
    );

    expect(memories.getMemory().activeProject).toBeNull();
  });

  it("uses the repository project as the authoritative active reference", () => {
    const projects = new LocalProjectRepository();
    projects.createProject(activeProject);
    const memories = new LocalMemoryRepository(projects);

    memories.saveMemory({
      ...DEFAULT_MEMORY,
      activeProject: { ...activeProject, name: "Stale name" },
    });

    expect(memories.getMemory().activeProject?.name).toBe("VAEORA");
    expect(projects.getActiveProject()?.name).toBe("VAEORA");
  });

  it("does not let a conflicting memory reference replace repository authority", () => {
    const projects = new LocalProjectRepository();
    const secondProject = {
      ...activeProject,
      id: "project-2",
      name: "Mita",
    };
    projects.createProject(activeProject);
    projects.createProject(secondProject);
    projects.setActiveProjectId(activeProject.id);
    window.localStorage.setItem(
      MEMORY_STATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        memory: {
          ...DEFAULT_MEMORY,
          activeProject: secondProject,
        },
        entries: [],
      }),
    );

    const memories = new LocalMemoryRepository(projects);

    expect(projects.getActiveProject()?.id).toBe(activeProject.id);
    expect(memories.getMemory().activeProject?.id).toBe(activeProject.id);
  });

  it("keeps legacy memory recoverable when migration persistence fails", () => {
    const serializedLegacy = JSON.stringify({
      ...DEFAULT_MEMORY,
      goals: ["Recover this goal"],
    });
    window.localStorage.setItem(
      LEGACY_MEMORY_STORAGE_KEY,
      serializedLegacy,
    );
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation((key) => {
        if (key === MEMORY_STATE_STORAGE_KEY) {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
      });

    const failedMigration = new LocalMemoryRepository(
      new LocalProjectRepository(),
    );

    expect(failedMigration.getMemory().goals).toEqual([
      "Recover this goal",
    ]);
    expect(window.localStorage.getItem(MEMORY_STATE_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_MEMORY_STORAGE_KEY)).toBe(
      serializedLegacy,
    );

    setItem.mockRestore();
    const recovered = new LocalMemoryRepository(
      new LocalProjectRepository(),
    );
    expect(recovered.getMemory().goals).toEqual([
      "Recover this goal",
    ]);
    expect(window.localStorage.getItem(MEMORY_STATE_STORAGE_KEY)).not.toBeNull();
  });
});
