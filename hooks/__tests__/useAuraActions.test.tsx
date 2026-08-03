import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MEMORY } from "@/constants/memory";
import {
  memoryRepository,
  MEMORY_STAGING_STORAGE_KEY,
} from "@/core/memory/MemoryRepository";
import { projectEngine } from "@/core/project/ProjectEngine";
import type { PlannedAuraAction } from "@/core/actions";
import type { Memory } from "@/types/memory";

import { useAuraActions } from "../useAuraActions";

const ACTION_HISTORY_KEY = "iaura-action-history";

function createAction(name: string): PlannedAuraAction {
  return {
    type: "create_project",
    value: name,
    description: "",
    goal: "",
    missionId: "",
    reason: "Requested by the user.",
  };
}

function renderActions(initialMemory: Memory) {
  return renderHook(() => {
    const [memory, setMemory] = useState(initialMemory);
    const actions = useAuraActions({
      memory,
      replaceMemory: setMemory,
    });

    return { memory, ...actions };
  });
}

describe("useAuraActions unified undo", () => {
  beforeEach(() => {
    window.localStorage.clear();
    projectEngine.restoreSnapshot({
      schemaVersion: 1,
      activeProjectId: null,
      projects: [],
    });
    memoryRepository.saveMemory({
      ...DEFAULT_MEMORY,
      activeProject: null,
    });
  });

  it("restores project and memory state together", () => {
    const { result } = renderActions({
      ...DEFAULT_MEMORY,
      projects: [],
      activeProject: null,
    });

    act(() => {
      result.current.executeActions([
        createAction("Undo project"),
      ]);
    });

    expect(result.current.memory.activeProject?.name).toBe(
      "Undo project",
    );
    expect(projectEngine.getProjects()).toHaveLength(1);
    expect(result.current.canUndoLast).toBe(true);

    let undone = false;
    act(() => {
      undone = result.current.undoLast();
    });

    expect(undone).toBe(true);
    expect(result.current.memory.activeProject).toBeNull();
    expect(projectEngine.getProjects()).toEqual([]);
  });

  it("keeps pre-P0B history entries compatible", () => {
    const created = projectEngine.createProject({
      name: "Legacy undo project",
    });
    const before: Memory = {
      ...DEFAULT_MEMORY,
      projects: [],
      activeProject: null,
    };
    const after: Memory = {
      ...before,
      projects: [created.name],
      activeProject: created,
    };
    window.localStorage.setItem(
      ACTION_HISTORY_KEY,
      JSON.stringify([
        {
          id: "legacy-history",
          createdAt: "2026-08-02T00:00:00.000Z",
          status: "completed",
          summaries: ["Proyecto creado"],
          before,
          after,
        },
      ]),
    );

    const { result } = renderActions(after);
    expect(result.current.canUndoLast).toBe(true);

    let undone = false;
    act(() => {
      undone = result.current.undoLast();
    });

    expect(undone).toBe(true);
    expect(projectEngine.getCurrentProject()).toBeNull();
    expect(projectEngine.getProjects()).toEqual([]);
    expect(result.current.memory.activeProject).toBeNull();
  });

  it("does not report action success when persistence fails", () => {
    const { result } = renderActions({
      ...DEFAULT_MEMORY,
      projects: [],
      activeProject: null,
    });
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === MEMORY_STAGING_STORAGE_KEY) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      return original.call(this, key, value);
    });

    let execution: ReturnType<typeof result.current.executeActions> = [];
    act(() => {
      execution = result.current.executeActions([createAction("Must roll back")]);
    });
    vi.restoreAllMocks();

    expect(execution[0]).toMatchObject({ status: "skipped" });
    expect(result.current.history).toEqual([]);
    expect(projectEngine.findEquivalentProject("Must roll back")).toBeNull();
  });

  it("rejects undo after an incompatible memory revision", () => {
    const { result } = renderActions({
      ...DEFAULT_MEMORY,
      projects: [],
      activeProject: null,
    });

    act(() => {
      result.current.executeActions([createAction("Keep after conflict")]);
    });
    memoryRepository.saveMemory({
      ...memoryRepository.getMemory(),
      goals: ["External change"],
    });

    let undone = true;
    act(() => {
      undone = result.current.undoLast();
    });

    expect(undone).toBe(false);
    expect(projectEngine.findEquivalentProject("Keep after conflict")).not.toBeNull();
  });
});
