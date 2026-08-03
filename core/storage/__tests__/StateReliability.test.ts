import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  atomicWriteState,
  type VersionedLocalState,
} from "../StateReliability";

interface TestState extends VersionedLocalState {
  value: string;
}

const keys = {
  storageKey: "test.state",
  stagingKey: "test.state.staging",
  backupKey: "test.state.backup",
};

function state(revision: number, value: string): TestState {
  return {
    schemaVersion: 1,
    revision,
    updatedAt: `2026-08-02T00:00:0${revision}.000Z`,
    writerId: "test-writer",
    migrationCompletedAt: "2026-08-02T00:00:00.000Z",
    value,
  };
}

function validate(value: unknown): TestState | null {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as TestState).revision !== "number" ||
    typeof (value as TestState).value !== "string"
  ) return null;
  return value as TestState;
}

describe("atomic local state writes", () => {
  beforeEach(() => window.localStorage.clear());

  it("stages, validates and promotes a successful write", () => {
    const result = atomicWriteState({
      scope: "project",
      ...keys,
      expectedCanonicalRaw: null,
      state: state(1, "current"),
      validate,
    });

    expect(result.result).toMatchObject({ ok: true, outcome: "committed" });
    expect(JSON.parse(localStorage.getItem(keys.storageKey) ?? "{}")).toMatchObject({
      revision: 1,
      value: "current",
    });
    expect(localStorage.getItem(keys.stagingKey)).toBeNull();
  });

  it("preserves the previous valid state when promotion fails", () => {
    const previous = JSON.stringify(state(1, "last-known-good"));
    localStorage.setItem(keys.storageKey, previous);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === keys.storageKey) throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, key, value);
    });

    const result = atomicWriteState({
      scope: "project",
      ...keys,
      expectedCanonicalRaw: previous,
      state: state(2, "new"),
      validate,
    });

    vi.restoreAllMocks();
    expect(result.result).toMatchObject({ ok: false, outcome: "failed" });
    expect(localStorage.getItem(keys.storageKey)).toBe(previous);
  });
});
