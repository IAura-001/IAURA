# Founder beta operations v1

## Audit and authoritative sources

- Supabase Auth `auth.users` owns account identity, registration, and last sign-in timestamps.
- `profiles` owns optional display metadata; `beta_memberships` and `beta_invites` own private-beta access and the founder/member role.
- `projects` is the authenticated project source of truth. Its composite `(user_id, id)` key and RLS isolate owners.
- `conversation_state` is the authenticated conversation/message snapshot source of truth. Its `user_id` primary key and RLS isolate owners.
- `beta_usage_events`, introduced by Beta Usage Visibility v1, stores bounded metadata-only events. Sign-in entry is deduplicated daily; project creation is written with the authoritative create; other events are best effort.
- `founder_beta_usage()` is the existing security-definer aggregation pattern. It authorizes from the caller's active founder membership and uses no service-role browser credential.

The previous view exposed usage stages but had no canonical activation/lifecycle states, summary, attention ordering, or data-quality reporting. Its RPC also treated every database error as an authorization error. Operations v1 fills only those gaps.

## Canonical model

The RPC returns facts and the server derives current lifecycle state. `registeredAt` comes from Auth; `lastActiveAt` is the greatest persisted sign-in, project update, conversation snapshot update, or usage event timestamp. Counts come from owner-keyed project and conversation rows. `meaningfulInteractionCount` is the persisted count of user-authored conversation messages; telemetry `message_sent` events are not added, avoiding double counting.

A user activates after at least one persisted user-authored message. Registration, sign-in, project creation, or opening a project alone does not activate the user.

Lifecycle thresholds are centralized in `core/betaUsage/types.ts`:

- `NEVER_ACTIVATED`: zero meaningful interactions, regardless of sign-in recency.
- `ACTIVE`: activated and last active no more than 7 days ago.
- `AT_RISK`: activated and last active more than 7 but no more than 21 days ago.
- `DORMANT`: activated and last active more than 21 days ago, missing, or invalid.

## Authorization and privacy

The browser cannot nominate a founder. Both the server page and GET endpoint call `founder_beta_usage()`, which denies by default unless `auth.uid()` has an active `founder` membership. The function returns scalar operational metadata only. It never returns project JSON, conversation JSON, message text, prompts, responses, memories, invite tokens, or notes.

Data-quality flags are observational and never repair data: missing profile, membership before registration, activity before registration, event/project ownership mismatch, and duplicate normalized email.
