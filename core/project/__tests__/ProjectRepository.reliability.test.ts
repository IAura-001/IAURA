import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LocalProjectRepository,
  PROJECT_BACKUP_STORAGE_KEY,
  PROJECT_STATE_STORAGE_KEY,
  PROJECT_STATE_VERSION,
  PROJECT_STAGING_STORAGE_KEY,
} from "../ProjectRepository";
import type { IAuraProject } from "@/types/project";

function project(id: string, name: string): IAuraProject {
  return {
    id,
    name,
    description: "",
    goal: "",
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    status: "planning",
    kind: "general",
    studios: { branding: false, website: false, app: false, marketing: false, documents: false },
  };
}

function currentState(revision: number, projects: IAuraProject[], activeProjectId: string | null) {
  return {
    schemaVersion: PROJECT_STATE_VERSION,
    revision,
    updatedAt: `2026-08-02T00:00:0${revision}.000Z`,
    writerId: "external-writer",
    migrationCompletedAt: "2026-08-02T00:00:00.000Z",
    activeProjectId,
    projects,
  };
}

describe("LocalProjectRepository reliability", () => {
  beforeEach(() => window.localStorage.clear());

  it("recovers an interrupted migration from the last-known-good snapshot", () => {
    const valid = currentState(4, [project("p1", "Valid")], "p1");
    localStorage.setItem(PROJECT_STATE_STORAGE_KEY, "{broken");
    localStorage.setItem(PROJECT_BACKUP_STORAGE_KEY, JSON.stringify(valid));
    localStorage.setItem(PROJECT_STAGING_STORAGE_KEY, JSON.stringify(currentState(5, [], null)));

    const repository = new LocalProjectRepository();

    expect(repository.getMigrationOutcome()).toBe("recovered");
    expect(repository.getActiveProject()?.id).toBe("p1");
    expect(localStorage.getItem(PROJECT_STAGING_STORAGE_KEY)).toBeNull();
  });

  it("isolates a corrupted project while preserving valid projects", () => {
    localStorage.setItem(
      PROJECT_STATE_STORAGE_KEY,
      JSON.stringify(currentState(2, [project("p1", "Valid"), { id: "", name: "Broken" } as IAuraProject], "missing")),
    );

    const repository = new LocalProjectRepository();

    expect(repository.getProjects().map(({ id }) => id)).toEqual(["p1"]);
    expect(repository.getActiveProject()).toBeNull();
  });

  it("does not downgrade or overwrite an unsupported future version", () => {
    const future = JSON.stringify({ schemaVersion: 99, privateFutureField: "preserve" });
    localStorage.setItem(PROJECT_STATE_STORAGE_KEY, future);

    const repository = new LocalProjectRepository();
    const result = repository.createProject(project("p1", "Blocked"));

    expect(repository.getMigrationOutcome()).toBe("failed_safely");
    expect(result).toMatchObject({ persisted: false, outcome: "failed", code: "IAURA_STATE_UNSUPPORTED_VERSION" });
    expect(localStorage.getItem(PROJECT_STATE_STORAGE_KEY)).toBe(future);
  });

  it("rejects a stale active-project write and refreshes to the winner", () => {
    const seed = new LocalProjectRepository();
    seed.createProject(project("p1", "One"));
    seed.createProject(project("p2", "Two"));
    const first = new LocalProjectRepository();
    const stale = new LocalProjectRepository();

    expect(first.setActiveProjectId("p1")).toBe(true);
    expect(stale.setActiveProjectId("p1")).toBe(false);
    expect(stale.getLastOperationResult()).toMatchObject({ outcome: "conflict", code: "IAURA_STATE_STALE_WRITE" });
    expect(stale.getActiveProject()?.id).toBe("p1");
  });

  it("observes a newer cross-tab update exactly once without writing it back", () => {
    const repository = new LocalProjectRepository({ synchronize: true });
    const listener = vi.fn();
    repository.subscribe(listener);
    const incoming = currentState(repository.getRevision() + 1, [project("p1", "Remote")], "p1");
    const raw = JSON.stringify(incoming);
    const writes = vi.spyOn(Storage.prototype, "setItem");

    window.dispatchEvent(new StorageEvent("storage", { key: PROJECT_STATE_STORAGE_KEY, newValue: raw }));

    expect(repository.getActiveProject()?.name).toBe("Remote");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(writes).not.toHaveBeenCalled();
    repository.dispose();
  });
});
