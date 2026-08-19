import { DEFAULT_MEMORY } from "@/constants/memory";
import type { Memory } from "@/types/memory";

import {
  memoryRepository,
} from "./MemoryRepository";

type Listener = () => void;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * activeProject is intentionally NOT persisted here.
 * project_state is the authenticated source of truth for that field.
 */
function persistentMemory(memory: Memory): Memory {
  return {
    ...clone(memory),
    activeProject: null,
  };
}

function serializedPersistentMemory(
  memory: Memory,
): string {
  return JSON.stringify(persistentMemory(memory));
}

export class AuthenticatedMemoryRepository {
  private userId: string | null = null;
  private pending: Promise<void> = Promise.resolve();
  private lastPersisted: string | null = null;

  configure(
    userId: string,
    remoteMemory: Memory | null,
  ): void {
    if (this.userId === userId) {
      return;
    }

    this.userId = userId;

    const currentActiveProject =
      memoryRepository.getMemory().activeProject;

    if (remoteMemory) {
      const hydrated: Memory = {
        ...DEFAULT_MEMORY,
        ...clone(remoteMemory),
        activeProject: currentActiveProject,
      };

      memoryRepository.saveMemory(hydrated);
      this.lastPersisted =
        serializedPersistentMemory(hydrated);

      return;
    }

    const cleanMemory: Memory = {
      ...DEFAULT_MEMORY,
      activeProject: currentActiveProject,
    };

    memoryRepository.saveMemory(cleanMemory);

    // A missing remote row is a clean local baseline, not permission
    // to overwrite the cloud automatically. Persistence begins only
    // after an actual Memory mutation.
    this.lastPersisted =
      serializedPersistentMemory(cleanMemory);
  }

  hydrateRemote(remoteMemory: Memory): void {
    if (!this.userId) {
      return;
    }

    const currentActiveProject =
      memoryRepository.getMemory().activeProject;

    const hydrated: Memory = {
      ...DEFAULT_MEMORY,
      ...clone(remoteMemory),
      activeProject: currentActiveProject,
    };

    memoryRepository.saveMemory(hydrated);

    this.lastPersisted =
      serializedPersistentMemory(hydrated);
  }

  reset(): void {
    this.userId = null;
    this.pending = Promise.resolve();
    this.lastPersisted = null;
  }

  getMemory(): Memory {
    return memoryRepository.getMemory();
  }

  saveMemory(memory: Memory): boolean {
    const persisted =
      memoryRepository.saveMemory(memory);

    if (persisted) {
      this.queueMemory(memory);
    }

    return persisted;
  }

  clearMemory(): void {
    const activeProject =
      memoryRepository.getMemory().activeProject;

    memoryRepository.clearMemory();

    const cleanMemory: Memory = {
      ...DEFAULT_MEMORY,
      activeProject,
    };

    memoryRepository.saveMemory(cleanMemory);
    this.queueMemory(cleanMemory);
  }

  subscribe(listener: Listener): () => void {
    return memoryRepository.subscribe(listener);
  }

  async flush(): Promise<void> {
    await this.pending;
  }

  private queueMemory(memory: Memory): void {
    const scopedUser = this.userId;

    if (!scopedUser) {
      return;
    }

    const persistent =
      persistentMemory(memory);

    const serialized =
      JSON.stringify(persistent);

    if (serialized === this.lastPersisted) {
      return;
    }

    this.lastPersisted = serialized;

    this.pending = this.pending
      .catch(() => undefined)
      .then(async () => {
        if (
          !scopedUser ||
          scopedUser !== this.userId
        ) {
          return;
        }

        const response = await fetch(
          "/api/memory-state",
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              memory: persistent,
            }),
          },
        );

        if (!response.ok) {
          this.lastPersisted = null;

          throw new Error(
            `Memory persistence failed (${response.status}).`,
          );
        }
      })
      .catch((error) => {
        console.error(
          "Unable to persist authenticated IAURA memory:",
          error,
        );
      });
  }
}

export const authenticatedMemoryRepository =
  new AuthenticatedMemoryRepository();
