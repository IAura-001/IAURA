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

const ACTION_HISTORY_KEY = "iaura-action-history:test-user";

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
      userId: "test-user",
      activeProjectId: memory.activeProject?.id ?? null,
      replaceMemory: setMemory,
    });

    return { memory, ...actions };
  });
}

function renderScopedActions(initialMemory: Memory, initialProjectId: string) {
  return renderHook(
    ({ projectId }) => {
      const [memory, setMemory] = useState(initialMemory);
      const actions = useAuraActions({
        memory,
        userId: "test-user",
        activeProjectId: projectId,
        replaceMemory: setMemory,
      });
      return { memory, ...actions };
    },
    { initialProps: { projectId: initialProjectId } },
  );
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

  it("does not attribute pre-scope history to the current project", () => {
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
    expect(result.current.history).toEqual([]);
    expect(result.current.canUndoLast).toBe(false);

    let undone = false;
    act(() => {
      undone = result.current.undoLast();
    });

    expect(undone).toBe(false);
    expect(projectEngine.getCurrentProject()?.id).toBe(created.id);
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

  it("isolates verified action history across A to B to A", () => {
    const actions = renderScopedActions(DEFAULT_MEMORY, "project-a");

    act(() => {
      actions.result.current.executeActions([{
        type: "add_goal", value: "Only A", description: "", goal: "",
        missionId: "", reason: "A",
      }], "project-a");
    });
    expect(actions.result.current.history[0].summaries).toContain("Meta creada: Only A");

    actions.rerender({ projectId: "project-b" });
    expect(actions.result.current.history).toEqual([]);

    act(() => {
      actions.result.current.executeActions([{
        type: "add_goal", value: "Only B", description: "", goal: "",
        missionId: "", reason: "B",
      }], "project-b");
    });
    expect(actions.result.current.history).toHaveLength(1);
    expect(actions.result.current.history[0].summaries).toContain("Meta creada: Only B");

    actions.rerender({ projectId: "project-a" });
    expect(actions.result.current.history).toHaveLength(1);
    expect(actions.result.current.history[0].summaries).toContain("Meta creada: Only A");
  });

  it("does not expose unscoped legacy history inside any project", () => {
    window.localStorage.setItem(ACTION_HISTORY_KEY, JSON.stringify([{
      id: "legacy", createdAt: "2026-08-01T00:00:00.000Z", status: "completed",
      summaries: ["Misión completada: Aura UI Button"],
      before: DEFAULT_MEMORY, after: DEFAULT_MEMORY,
    }]));

    const actions = renderScopedActions(DEFAULT_MEMORY, "project-a");
    expect(actions.result.current.history).toEqual([]);
    actions.rerender({ projectId: "project-b" });
    expect(actions.result.current.history).toEqual([]);
  });

  it("keeps an async A result out of B by using the captured project scope", () => {
    const actions = renderScopedActions(DEFAULT_MEMORY, "project-a");
    actions.rerender({ projectId: "project-b" });

    act(() => {
      actions.result.current.executeActions([{
        type: "add_goal", value: "Late A action", description: "", goal: "",
        missionId: "", reason: "late response",
      }], "project-a");
    });

    expect(actions.result.current.history).toEqual([]);
    actions.rerender({ projectId: "project-a" });
    expect(actions.result.current.history[0].summaries)
      .toContain("Meta creada: Late A action");
  });
});
