# AI usage and cost control v1

## Billable paths

VAEORA has five provider-operation paths: IAURA chat and Creative Copy use OpenAI Responses; Creative Image uses OpenAI Images; transcription uses OpenAI Audio Transcriptions; voice uses ElevenLabs and, after a failed primary attempt, OpenAI Speech as a separately reserved fallback operation. Requests are non-streaming and automatic SDK retries are disabled so one reservation initiates at most one provider request. A completed response is deduplicated by provider request ID where available.

## Event and cost semantics

`ai_usage_events` is append-oriented and content-free. A trusted server reservation is created atomically before a provider call, then finalized as succeeded or failed. It stores user, time, provider, actual model, operation type, safe request IDs, provider-reported token categories, usage availability, status, estimated USD cost, and pricing version. Prompts, messages, responses, memory, project content, audio, images, and secrets are never stored.

Text and transcription estimates are calculated once at event completion and remain historically stable. Pricing version `openai-2026-08-24-v1` maps explicit model IDs. Cached tokens are removed from ordinary input and priced at their cached rate; output pricing already includes reasoning tokens reported inside output usage. Unknown models or missing usage produce an unavailable cost, never zero.

> VAEORA's USD cost figures are internal estimates based on provider-reported usage and the configured pricing version unless an authoritative provider billing API is explicitly integrated.

Image, ElevenLabs, and OpenAI Speech operations currently lack a compatible authoritative usage payload at these SDK boundaries, so they remain visible as unpriced operations. This is intentionally incomplete rather than fabricated.

## Guardrail and anomalies

The database serializes reservations per user with a transaction advisory lock. Every account, including founders, defaults to 100 reserved provider operations in a rolling 24 hours and three reservations concurrently (reservations older than ten minutes no longer count as concurrent). Server-only rows in `ai_usage_policies` can set a stricter or wider per-user operation/concurrency ceiling; absence of a founder override still applies the default rather than bypassing it. A denied reservation occurs before provider construction/call and returns a calm 429 response. Browser state and authenticated direct RPC calls cannot reset or write financial data; only the server-side service role can reserve/finalize events or administer policies.

Daily anomaly thresholds are centralized in the founder RPC: ELEVATED at 25 operations, 100k tokens, $1, or at least 10 operations and four times that day's beta-user average; HIGH at 50, 250k, or $3; REVIEW at 80, 500k, or $5. Labels are neutral operational signals.

## Deployment

Apply the database migration first, configure the server-only `SUPABASE_SERVICE_ROLE_KEY`, deploy the matching application, then verify all provider routes. Do not expose the service-role key through `NEXT_PUBLIC_*` variables.
