import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MEMORY } from "@/constants/memory";
import { LocalProjectRepository } from "@/core/project/ProjectRepository";
import {
  LocalMemoryRepository,
  MEMORY_BACKUP_STORAGE_KEY,
  MEMORY_STATE_STORAGE_KEY,
  MEMORY_STATE_VERSION,
} from "../MemoryRepository";

function currentState(revision: number, goals: string[]) {
  return {
    schemaVersion: MEMORY_STATE_VERSION,
    revision,
    updatedAt: `2026-08-02T00:00:0${revision}.000Z`,
    writerId: "external-memory",
    migrationCompletedAt: "2026-08-02T00:00:00.000Z",
    memory: { ...DEFAULT_MEMORY, goals },
    entries: [],
  };
}

describe("LocalMemoryRepository reliability", () => {
  beforeEach(() => window.localStorage.clear());

  it("recovers invalid JSON from the last-known-good memory snapshot", () => {
    localStorage.setItem(MEMORY_STATE_STORAGE_KEY, "{broken");
    localStorage.setItem(MEMORY_BACKUP_STORAGE_KEY, JSON.stringify(currentState(3, ["Preserved goal"])));

    const repository = new LocalMemoryRepository(new LocalProjectRepository());

    expect(repository.getMigrationOutcome()).toBe("recovered");
    expect(repository.getMemory().goals).toEqual(["Preserved goal"]);
  });

  it("observes newer cross-tab memory without a write-back loop", () => {
    const repository = new LocalMemoryRepository(
      new LocalProjectRepository(),
      { synchronize: true },
    );
    const listener = vi.fn();
    repository.subscribe(listener);
    const incoming = currentState(repository.getRevision() + 1, ["Remote goal"]);
    const writes = vi.spyOn(Storage.prototype, "setItem");

    window.dispatchEvent(new StorageEvent("storage", {
      key: MEMORY_STATE_STORAGE_KEY,
      newValue: JSON.stringify(incoming),
    }));

    expect(repository.getMemory().goals).toEqual(["Remote goal"]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(writes).not.toHaveBeenCalled();
    repository.dispose();
  });

  it("fails safely without overwriting future memory state", () => {
    const future = JSON.stringify({ schemaVersion: 99, future: true });
    localStorage.setItem(MEMORY_STATE_STORAGE_KEY, future);

    const repository = new LocalMemoryRepository(new LocalProjectRepository());
    const result = repository.saveMemoryResult({ ...DEFAULT_MEMORY, goals: ["Blocked"] });

    expect(result).toMatchObject({ ok: false, code: "IAURA_STATE_UNSUPPORTED_VERSION" });
    expect(localStorage.getItem(MEMORY_STATE_STORAGE_KEY)).toBe(future);
  });
});
