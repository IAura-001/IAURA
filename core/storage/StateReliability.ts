export type StateScope = "project" | "memory" | "conversation";

export type StateOperationOutcome =
  | "committed"
  | "unchanged"
  | "conflict"
  | "failed";

export type StateErrorCode =
  | "IAURA_STATE_STORAGE_UNAVAILABLE"
  | "IAURA_STATE_SERIALIZATION_FAILED"
  | "IAURA_STATE_STAGING_FAILED"
  | "IAURA_STATE_VALIDATION_FAILED"
  | "IAURA_STATE_PERSISTENCE_FAILED"
  | "IAURA_STATE_STALE_WRITE"
  | "IAURA_STATE_UNSUPPORTED_VERSION";

export interface StateOperationResult {
  ok: boolean;
  outcome: StateOperationOutcome;
  revision: number;
  code?: StateErrorCode;
}

export type MigrationOutcome =
  | "migrated"
  | "already_current"
  | "recovered"
  | "failed_safely";

export type StateDiagnosticCode =
  | "IAURA_STATE_MIGRATION_STARTED"
  | "IAURA_STATE_MIGRATION_COMPLETED"
  | "IAURA_STATE_MIGRATION_RECOVERED"
  | "IAURA_STATE_STALE_WRITE_REJECTED"
  | "IAURA_STATE_CORRUPTED_RECORD_ISOLATED"
  | "IAURA_STATE_PERSISTENCE_FAILURE"
  | "IAURA_STATE_LAST_KNOWN_GOOD_RECOVERED"
  | "IAURA_STATE_FUTURE_VERSION_REJECTED";

export interface VersionedLocalState {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  writerId: string;
  migrationCompletedAt: string;
}

interface AtomicWriteInput<State extends VersionedLocalState> {
  scope: StateScope;
  storageKey: string;
  stagingKey: string;
  backupKey: string;
  expectedCanonicalRaw: string | null;
  state: State;
  validate: (value: unknown) => State | null;
}

export interface AtomicWriteOutput {
  result: StateOperationResult;
  canonicalRaw?: string;
}

function storageAvailable(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function readLocalState(key: string): {
  ok: boolean;
  value: string | null;
} {
  if (!storageAvailable()) return { ok: false, value: null };

  try {
    return { ok: true, value: window.localStorage.getItem(key) };
  } catch {
    return { ok: false, value: null };
  }
}

export function writeLocalState(key: string, value: string): boolean {
  if (!storageAvailable()) return false;

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeLocalState(key: string): boolean {
  if (!storageAvailable()) return false;

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function parseLocalState(raw: string | null): unknown {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function schemaVersionOf(value: unknown): number | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const schemaVersion = (value as Record<string, unknown>).schemaVersion;
  return typeof schemaVersion === "number" && Number.isFinite(schemaVersion)
    ? schemaVersion
    : null;
}

export function createWriterId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    "randomUUID" in globalThis.crypto
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `writer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function reportStateDiagnostic(
  scope: StateScope,
  code: StateDiagnosticCode,
  details: Record<string, string | number | boolean | null> = {},
): void {
  const record = { scope, code, ...details };

  if (
    code === "IAURA_STATE_PERSISTENCE_FAILURE" ||
    code === "IAURA_STATE_FUTURE_VERSION_REJECTED" ||
    code === "IAURA_STATE_STALE_WRITE_REJECTED"
  ) {
    console.warn("IAURA state diagnostic", record);
    return;
  }

  console.info("IAURA state diagnostic", record);
}

function failed(
  revision: number,
  code: StateErrorCode,
): AtomicWriteOutput {
  return {
    result: {
      ok: false,
      outcome: "failed",
      revision,
      code,
    },
  };
}

export function atomicWriteState<State extends VersionedLocalState>({
  scope,
  storageKey,
  stagingKey,
  backupKey,
  expectedCanonicalRaw,
  state,
  validate,
}: AtomicWriteInput<State>): AtomicWriteOutput {
  let serialized: string;

  try {
    serialized = JSON.stringify(state);
  } catch {
    reportStateDiagnostic(scope, "IAURA_STATE_PERSISTENCE_FAILURE", {
      code: "IAURA_STATE_SERIALIZATION_FAILED",
    });
    return failed(state.revision, "IAURA_STATE_SERIALIZATION_FAILED");
  }

  if (!validate(parseLocalState(serialized))) {
    reportStateDiagnostic(scope, "IAURA_STATE_PERSISTENCE_FAILURE", {
      code: "IAURA_STATE_VALIDATION_FAILED",
    });
    return failed(state.revision, "IAURA_STATE_VALIDATION_FAILED");
  }

  const current = readLocalState(storageKey);
  if (!current.ok) {
    return failed(state.revision, "IAURA_STATE_STORAGE_UNAVAILABLE");
  }

  if (
    current.value !== expectedCanonicalRaw &&
    current.value !== null
  ) {
    reportStateDiagnostic(scope, "IAURA_STATE_STALE_WRITE_REJECTED", {
      revision: state.revision,
    });
    return {
      result: {
        ok: false,
        outcome: "conflict",
        revision: state.revision,
        code: "IAURA_STATE_STALE_WRITE",
      },
    };
  }

  if (!writeLocalState(stagingKey, serialized)) {
    reportStateDiagnostic(scope, "IAURA_STATE_PERSISTENCE_FAILURE", {
      code: "IAURA_STATE_STAGING_FAILED",
    });
    return failed(state.revision, "IAURA_STATE_STAGING_FAILED");
  }

  const staged = readLocalState(stagingKey);
  if (
    !staged.ok ||
    staged.value !== serialized ||
    !validate(parseLocalState(staged.value))
  ) {
    removeLocalState(stagingKey);
    return failed(state.revision, "IAURA_STATE_VALIDATION_FAILED");
  }

  const previousValid =
    expectedCanonicalRaw !== null &&
    validate(parseLocalState(expectedCanonicalRaw)) !== null;
  if (
    previousValid &&
    !writeLocalState(backupKey, expectedCanonicalRaw)
  ) {
    removeLocalState(stagingKey);
    return failed(state.revision, "IAURA_STATE_PERSISTENCE_FAILED");
  }

  if (!writeLocalState(storageKey, serialized)) {
    removeLocalState(stagingKey);
    reportStateDiagnostic(scope, "IAURA_STATE_PERSISTENCE_FAILURE", {
      code: "IAURA_STATE_PERSISTENCE_FAILED",
    });
    return failed(state.revision, "IAURA_STATE_PERSISTENCE_FAILED");
  }

  const promoted = readLocalState(storageKey);
  if (
    !promoted.ok ||
    promoted.value !== serialized ||
    !validate(parseLocalState(promoted.value))
  ) {
    if (previousValid && expectedCanonicalRaw !== null) {
      writeLocalState(storageKey, expectedCanonicalRaw);
    }
    removeLocalState(stagingKey);
    return failed(state.revision, "IAURA_STATE_VALIDATION_FAILED");
  }

  removeLocalState(stagingKey);

  return {
    result: {
      ok: true,
      outcome: "committed",
      revision: state.revision,
    },
    canonicalRaw: serialized,
  };
}
