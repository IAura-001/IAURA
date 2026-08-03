# IAURA state consolidation

## Scope

P0B consolidates the current local-first project and structured-memory state. It does not add remote persistence, authentication, semantic memory, embeddings, or a database.

## Authoritative project source

`IAuraProject` is the authoritative project representation because it already preserves the data required by Project views, Branding Studio, Creative Studio, Launch Studio, approved assets, project status, and IAURA context.

`LocalProjectRepository` owns the authoritative collection and the single active-project identifier. `ProjectEngine` remains the compatibility and domain adapter used by existing studios and project UI.

The repository prevents equivalent normalized project names from being created twice and persists the active project explicitly. Consumers can no longer independently decide which project is active.

When project and memory snapshots disagree, the valid active ID in `iaura.project-state` wins. A memory snapshot can seed the active project only when the project repository does not already have one.

## Memory repository contract

`LocalMemoryRepository` is the official structured-memory access contract. It owns the current `Memory` profile and `MemoryEntry` records used by `MemoryEngine`.

Supported structured state remains limited to existing product data:

- user profile and locale;
- goals and habits;
- compatibility project-name list;
- authoritative active-project reference;
- mission and progression state;
- explicitly inserted typed memory entries.

The repository does not infer facts or automatically promote conversation content into durable memory.

## Storage keys

| Key | Version | Role |
| --- | ---: | --- |
| `iaura.project-state` | 1 | Authoritative projects and active-project ID |
| `iaura.memory-state` | 1 | Authoritative structured memory and typed entries |
| `iaura.projects` | Legacy | Compatibility mirror and migration source |
| `iaura-memory` | Legacy | Compatibility mirror and migration source |
| `iaura-action-history` | Legacy/current | Existing local undo history |

Legacy project and memory keys are retained after migration. Successful writes update them as best-effort compatibility mirrors, while success is determined by the versioned source write.

## Migration strategy

Migration runs when each local repository is initialized.

1. Read and validate the versioned state when available.
2. Read the corresponding legacy keys safely.
3. Normalize only valid project and memory records.
4. Merge project snapshots by ID or normalized equivalent name.
5. When legacy memory contains a full active project, preserve older name-only project references as deterministic minimal records.
6. Preserve unknown project fields when the base record is valid.
7. Select one valid active-project ID.
8. Persist the versioned state without deleting legacy data.

The migration is idempotent. Repeated initialization does not create additional projects. Invalid JSON, invalid arrays, and partially corrupted entries are ignored or normalized to safe defaults.

## Compatibility adapters

- `ProjectEngine` preserves the existing studio-facing API.
- `ProjectStorage` preserves legacy `load`, `save`, and `clear` calls while delegating to `ProjectRepository`.
- `useMemory` preserves the existing React hook API while delegating persistence to `MemoryRepository`.
- `MemoryEngine` preserves typed add, search, filter, and count APIs while using `MemoryRepository`.
- `executeAuraActions` preserves its existing call signature and accepts an optional repository-aware dependency for deterministic tests.

## Request and action data flow

```text
Project/Studio UI
      │
      ▼
ProjectEngine compatibility API
      │
      ▼
LocalProjectRepository ──► iaura.project-state
      │
      ├──► ContextBuilder ──► Brain cognitive request
      │
      └──► MemoryRepository active-project reference

IAURA structured action
      │
      ▼
ActionExecutor ──► ProjectEngine ──► LocalProjectRepository
      │                     │
      │                     └── persistence result controls receipt
      ▼
MemoryRepository ──► iaura.memory-state
      │
      └──► existing action history and undo snapshot
```

Project creation is only reported as executed after the authoritative repository confirms persistence. A failed creation is removed from the in-session project snapshot before a skipped receipt is returned. Undo history optionally carries project snapshots so new entries can restore project and memory state together. Older history entries remain readable and use their before/after memory snapshots as a compatibility fallback.

## Context behavior

`ContextBuilder` reads the active project only through `ProjectRepository`. Existing section and total-length limits remain unchanged. Only the current project revision, approved relevant assets, and bounded studio content enter the cognitive context.

The general user-profile context intentionally excludes project snapshots; ContextBuilder appends the authoritative project context separately.

## Current limitations

- Persistence is browser-local and does not synchronize across devices.
- Cross-tab live synchronization is not implemented.
- Legacy mirrors remain until a future deprecation mission measures remaining usage.
- LocalStorage provides no multi-key transaction; failed writes are surfaced and actions are not reported as successful, but recovery is still best-effort.
- Memory entries use structured retrieval only; semantic retrieval is intentionally outside P0B.

## Future backend migration

The repository interfaces are the backend boundary. A future remote implementation can replace `LocalProjectRepository` and `LocalMemoryRepository` while keeping `ProjectEngine`, `MemoryEngine`, ContextBuilder, actions, studios, and UI contracts stable. A backend mission should add conflict resolution, authenticated ownership, remote migrations, and offline reconciliation without changing the domain types first.
