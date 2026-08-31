# SaaS data readiness v1

## Ownership map

| Data class | Current authority | Owner key | Export/deletion/cross-device |
|---|---|---|---|
| Auth identity/profile | Supabase Auth + `profiles` | Auth UUID | Account deletion; profile is not yet in a full account archive; cloud |
| Projects, active project, Theme DNA, Brand System, Creative Direction, Website Kit, Launch Studio, Library metadata | `projects` + `project_state` | `user_id` | Project ZIP for project data; cascade deletion; cloud |
| Conversations | `conversation_state` | `user_id` | Account deletion; account export deferred; cloud |
| Memory | `memory_state` | `user_id` | Account deletion; account export deferred; cloud |
| Intelligence | intelligence tables | `user_id`, project scope when applicable | Account/project deletion through existing FKs; account export deferred; cloud |
| Creative originals/thumbnails | private `creative-assets` bucket + `creative_asset_objects` | Auth UUID + owned project + asset ID | Project ZIP, asset/project/account deletion; cloud-authoritative with IndexedDB cache |
| Legacy creative binaries | IndexedDB | browser profile | Lazy-compatible cache; upload on subsequent save/update; never destructively removed |
| AI usage | `ai_usage_events` | Auth UUID, optional authoritative project ID | Deleted with current account FK; excluded from user content exports |
| Product analytics | `beta_usage_events` | Auth UUID | Deleted with current account FK; content-free and excluded from exports |
| Voice/audio | Request-only | Auth session | Ephemeral provider processing; no audio/transcript persistence by VAEORA analytics |

## Private asset model

Objects use deterministic paths: `{user UUID}/{project ID}/{asset ID}/original|thumbnail`. The bucket is private. Storage and inventory RLS require the authenticated UUID in the path and an owned project. Uploads allow PNG, WebP, or JPEG, with 20 MiB originals and 2 MiB thumbnails. Metadata loads first; short-lived signed URLs and originals are fetched lazily.

The upload order is binary → inventory row. If thumbnail or inventory persistence fails, newly uploaded objects are removed. Duplicate asset IDs with the same byte size are idempotent; conflicting sizes fail. A cloud failure can retain the device original without claiming cloud persistence. Existing IndexedDB originals are preserved and can be uploaded on a subsequent mutation. Missing binaries produce `410` and are explicitly marked unavailable in exports.

Deletion ordering is object(s) → metadata/project/account. A storage failure stops destructive metadata deletion so the operation can be retried. The small repair surface is the private inventory table: orphan objects can be compared to inventory paths, and missing objects remain explicit rather than fabricated.

## Export format

Project export is a version-1 ZIP with `manifest.json` and available originals under immutable `assets/{asset-id}.{extension}` paths. It contains user-owned project state and portable asset metadata. Provider request IDs, model IDs, generation prompts, analytics, cost records, authorization data, system prompts, and secrets are excluded. Missing binaries remain manifest entries with `available: false`. Full account export (profile, memory, intelligence, and conversations) is still a defined gap and requires a separately reviewed archive contract.

## Account lifecycle and retention

- Active-account user content remains until the user deletes the relevant asset/project/account.
- Account deletion requires an authenticated session and exact destructive confirmation. Private objects are deleted first; deleting the Auth user then cascades directly linked content, analytics, and AI usage rows.
- The current implementation retains no directly linked analytics or AI cost rows after Auth deletion. Future statutory accounting needs should use de-identified aggregates, never retained user linkage by default.
- Provider-side processing and support/security log retention depend on provider and operational configuration; VAEORA makes no certification claim. Application logs must remain content-minimized.
- Formal Terms and Privacy Policy are **MISSING**. The in-product storage/AI/voice/analytics disclosure is a **DRAFT requiring legal review**. Support routing exists but is not a substitute for legal documents.

## Cost attribution

`ai_usage_events.project_id` is nullable and accepted only when the authenticated user owns the project. Chat propagates the structurally captured conversation project; creative copy/image use their validated project scope. Speech and transcription remain global because no authoritative project is carried. Image provider/model/unit metadata continues through the existing ledger; speech/transcription provider usage remains incomplete where providers do not return metering. Asset byte totals and counts are derived from `creative_asset_objects`; storage egress is not yet metered.

## Security review notes

This is an engineering review, not a formal security audit. New APIs authenticate server-side and re-check project/asset ownership. Object paths reject traversal characters and never contain email. MIME and size are enforced at API and bucket levels. Buckets are private, signed URLs are short-lived, downloads use `nosniff`, exports use safe immutable archive paths, reset requests use neutral messaging, and deletion cannot name another user. Local migration execution remains blocked until a local container/Postgres runtime exists; no remote environment may substitute.
