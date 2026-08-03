# IAURA state reliability

IAURA keeps project state and memory in separate authoritative local repositories. P0C preserves those P0B boundaries and adds a common reliability protocol around `localStorage`; it does not introduce remote persistence or a new state architecture.

## Write lifecycle

Each canonical state contains `schemaVersion`, a monotonically increasing `revision`, `updatedAt`, `writerId`, and `migrationCompletedAt`.

1. Build and normalize the next state in memory.
2. Serialize it before changing canonical storage.
3. Compare the canonical raw value with the value read by the repository. A different non-null value is a stale-write conflict.
4. Write the serialized candidate to `.staging`, read it back, and validate it.
5. Copy the prior canonical state to `.backup` only when that prior state is valid.
6. Promote the staged value to the canonical key and validate it again.
7. Remove staging and update the repository cache only after successful promotion.

Any failure returns a typed result and leaves the in-memory state unchanged. The previous canonical value remains available. Legacy mirrors are written only after canonical success and remain best-effort compatibility outputs.

## Recovery and migrations

Repository startup reports one typed migration outcome:

- `migrated`: legacy or version 1 state was normalized and committed as version 2.
- `already_current`: a valid version 2 state was loaded without mutation.
- `recovered`: an interrupted write was resolved using the valid canonical or last-known-good backup.
- `failed_safely`: storage was unavailable, migration could not be persisted, or a future schema was detected.

A valid canonical snapshot wins over an abandoned staged value. If canonical data is absent or corrupt, a valid backup is preferred over staging. Legacy data is never deleted during migration. Individual malformed project or memory-entry records are isolated while valid records remain usable. A schema newer than the running application is never overwritten or downgraded.

## Revision and conflict rules

Successful mutations increment `revision`. A repository instance retains the exact canonical value it read; promotion is rejected if another writer has replaced that value. On conflict, the losing instance refreshes to the newer valid canonical state and returns `IAURA_STATE_STALE_WRITE`, allowing the caller to refresh or retry explicitly.

For storage events, a larger revision wins. Equal revisions are ordered deterministically by `updatedAt` and then `writerId`. Duplicate project names remain normalized and deduplicated by the existing project rules.

## Cross-tab synchronization

Production repository singletons listen to the browser `storage` event. A valid newer snapshot updates the local cache and notifies subscribers without writing back, preventing loops. Project changes also refresh memory's derived active-project reference, with the project repository remaining authoritative after legacy migration. Hooks subscribe to memory changes so IAURA surfaces observe external updates without a reload.

## Undo safety

New action-history entries record project and memory revisions before and after execution. Undo proceeds only when current revisions match the recorded post-action revisions. Project and memory restoration use conditional writes. A conflict or persistence failure returns failure, preserves current state, and does not mark the history entry as undone. Older history entries remain supported through the existing snapshot and value checks.

## Diagnostic codes

Diagnostics contain only scope, code, revision/count metadata, and recovery source. They never include raw storage, conversations, environment values, or user content.

- `IAURA_STATE_MIGRATION_STARTED`
- `IAURA_STATE_MIGRATION_COMPLETED`
- `IAURA_STATE_MIGRATION_RECOVERED`
- `IAURA_STATE_LAST_KNOWN_GOOD_RECOVERED`
- `IAURA_STATE_CORRUPTED_RECORD_ISOLATED`
- `IAURA_STATE_STALE_WRITE_REJECTED`
- `IAURA_STATE_PERSISTENCE_FAILURE`
- `IAURA_STATE_FUTURE_VERSION_REJECTED`

Operation failures additionally expose structured codes for unavailable storage, serialization, staging, validation, persistence, stale writes, and unsupported versions.

## Current limitations and future backend considerations

`localStorage` cannot provide a multi-key transaction, so project and memory restoration is coordinated with conditional revisions and compensating writes rather than a true atomic transaction. Storage events synchronize tabs in the same browser profile only and do not synchronize devices. A future remote backend should preserve repository contracts, server-side compare-and-swap revisions, idempotent migrations, conflict responses, and privacy-safe diagnostics instead of bypassing them.
