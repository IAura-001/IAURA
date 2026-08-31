# Plan-neutral entitlements v1

## Authority and model

Product code asks whether a capability is allowed and how much resource remains. It never branches on a commercial plan name. The canonical state is:

`profile definition + active user assignment + active override + authoritative usage -> effective entitlement document -> decision`

Definitions live in `entitlement_profiles`; time-bounded assignments and overrides live in user-scoped tables and cascade with Auth deletion. `resolve_current_entitlements()` is the sole authenticated resolution path. Clients may read its safe projection from `GET /api/entitlements`, but protected operations always resolve again on the server. Local storage, analytics, project metadata, and future billing are not entitlement authorities.

The deterministic fallback is `beta_default_v1`. Its deliberately generous limits preserve current development/founder workflows and keep the 3–5 minute onboarding path inside the allowance. `internal_unrestricted_v1` is an explicit assignment target for authorized internal users; feature code never inspects that ID. Assignments support `starts_at`, `ends_at`, and fallback after expiry, so a future 14-day trial requires no product-logic rewrite.

## Capabilities and limits

Boolean capabilities:

- `project.create`
- `ai.chat`, `ai.creative_copy`, `ai.creative_image`, `ai.transcription`, `ai.speech`
- `image.tier.draft`, `image.tier.premium`, `image.tier.ultra`
- `asset.upload`

Independent numeric/metered resources:

- active projects (all non-deleted, non-completed project rows; there is no archive UX yet)
- AI operations in the current calendar month
- weighted image credits in the current calendar month: draft 1, premium 2, ultra 6
- stored original plus thumbnail bytes
- cloud asset count
- concurrent AI reservations

Calendar-month allowances are a neutral entitlement period, not a Stripe billing period. The existing rolling 24-hour operation ceiling and stale-reservation concurrency ceiling remain safety guardrails. Creative process-local windows, payload limits, generated-image limits, audio limits, provider budgets, and deployment configuration remain provider/technical defenses. Provider cost remains in the existing AI cost ledger and is never presented as entitlement credit.

## Decisions and failures

Safe decisions carry capability, allowed, reason, limit, used, remaining, and optional reset time. Reason codes are `CAPABILITY_NOT_ALLOWED`, `PROJECT_LIMIT_REACHED`, `AI_ALLOWANCE_EXHAUSTED`, `IMAGE_ALLOWANCE_EXHAUSTED`, `IMAGE_TIER_NOT_ALLOWED`, `STORAGE_LIMIT_EXCEEDED`, `ASSET_LIMIT_REACHED`, `CONCURRENCY_LIMIT_REACHED`, and `SAFETY_LIMIT_REACHED`.

Commercial-style entitlement denials return neutral HTTP 403 responses. Safety exhaustion remains HTTP 429 with retry information. Authentication remains 401, invalid ownership/scope remains authorization or validation failure, provider failures retain provider-specific handling, and entitlement infrastructure outages fail closed as 503. No response suggests an upgrade.

## Atomicity, retries, and usage

`create_project_with_entitlement` takes a per-user advisory transaction lock, treats an owned duplicate project ID as an idempotent retry, counts active projects, decides, and inserts in one transaction. Analytics runs afterward and cannot change the decision.

`reserve_ai_usage_operation` remains the single AI ledger reservation. Under the existing per-user lock it resolves entitlements, checks monthly operation allowance, image tier/weight, commercial concurrency, then the independent 24-hour and concurrency safety ceilings, and finally inserts one reservation. Accepted reservations count against allowance, including provider failures; retries must use the caller's stable request ID where available. A speech provider fallback creates a separate cost attempt with zero additional entitlement units, avoiding double allowance consumption.

`reserve_asset_storage` locks per user and includes active 15-minute reservations plus inventory bytes/count. The API then uploads objects and calls `finalize_asset_storage`, or releases the reservation and cleans uploaded objects on failure. This prevents two near-limit uploads from both passing without loading binaries. Expired reservations are repaired lazily.

## Existing-limit audit

| Existing control | Classification | Entitlement relationship |
|---|---|---|
| AI `max_operations_24h` and `max_concurrent` | Safety limit | Independent ceiling after allowance decision |
| Creative 1/10-minute units, concurrency, duplicate windows | Cost guardrail / beta defense-in-depth | Preserved; not commercial authority |
| Creative production guard environment acknowledgement | Cost/provider guardrail | Preserved fail-closed |
| Image tiers and 1/2/6 weights | Provider-cost model | Reused for separate image allowance |
| Provider hard-spend/external limiter configuration | Provider/cost guardrail | Never exposed as user allowance |
| 20 MiB original, 2 MiB thumbnail, generated-image and audio byte caps | Technical/provider limit | Always enforced regardless of entitlement |
| Context, memory, API page, history and payload bounds | Safety/technical limit | Not commercialized |
| Intelligence priority constraint | Product-domain structural limit | Out of entitlement scope |
| Explicit internal profile assignment/override | Internal override | Centralized; no feature bypasses |
| Current private-beta access gate | Beta authorization | Remains separate from entitlements |

## Future billing synchronization contract

Mission 8 may add a privileged adapter with this narrow responsibility:

1. Receive verified subscription/trial state.
2. Map an external product/price to an internal entitlement profile ID outside feature code.
3. Upsert `user_entitlement_assignments` with source `billing_sync`, `starts_at`, and `ends_at`.
4. Let the existing resolver and protected operations observe the new effective state.

Billing must not write feature flags, usage rows, project metadata, local storage, or overrides. No Stripe IDs, prices, billing secrets, or provider-cost internals exist in the current entitlement schema or read endpoint.

## Privacy and operations

The endpoint exposes only the current authenticated user's effective profile ID, capabilities, limits, summarized usage, assignment dates, and reset dates. It exposes no override reason or accounting internals. Entitlement-denial telemetry is not added in v1; therefore no prompt/content can enter a new analytics path and the existing ledgers remain singular.

Founder debugging uses the same authenticated read endpoint plus existing founder-only usage/cost pages. A larger admin system is intentionally deferred.

## Verification gap

The migration is local-only and statically/test validated. Live database execution and real concurrent transaction verification remain blocked until an approved local Supabase/Postgres runtime exists. Production Supabase is not a substitute and the migration must not be applied remotely during this mission.
