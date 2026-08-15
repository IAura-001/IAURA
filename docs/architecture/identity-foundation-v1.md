# IAURA Identity Foundation v1

## Boundary

The private `/access` threshold remains the temporary outer beta gate. It does
not identify a person. Supabase Auth will later establish identity, and an
active `beta_memberships` row will establish continuing beta authorization.

No current application repository uses Supabase in Identity Foundation v1.

## Invite claim contract

`public.claim_beta_invite(invite_token text)` is the only end-user-accessible
identity lifecycle write. It derives the user from `auth.uid()`, hashes the raw
token inside PostgreSQL, locks the matching invite row, validates revocation,
expiration, capacity, and normalized Auth email, then increments the claim and
creates a `member` membership in one transaction.

The row lock serializes concurrent claims. The invite constraint prevents the
counter exceeding `max_claims`; the membership primary key permits only one
membership per user. The function always writes role `member`. Founder role
creation and all membership lifecycle administration are deferred to a later,
server-authorized founder operation.

Invite tokens must be generated with cryptographically secure randomness. Only
their lowercase SHA-256 hex digest is inserted into `token_hash`; plaintext
tokens must never be logged or persisted.

## Future user-owned persistence

Future tables follow these rules:

- `projects.user_id` is non-null and references `auth.users(id)`. All CRUD is
  restricted to `user_id = auth.uid()`.
- `conversations` has non-null `user_id`. A composite ownership key/foreign key
  must ensure `(project_id, user_id)` can only reference a project with the same
  owner.
- `messages` must not rely on a browser-supplied owner. Prefer a composite
  `(conversation_id, user_id)` foreign key plus direct `user_id`, allowing RLS
  and constraints to enforce the same owner at both levels.
- `memories.user_id` is non-null. Optional project scope uses the same composite
  owner relationship as conversations.
- Route handlers and server actions derive ownership from a verified Supabase
  user. A `userId` in a request body is never authoritative.
- RLS is enabled and tested before browser clients can access any personal
  table. Service-role credentials remain server-only and are not the normal
  user-data access path.

## Repository adapter seam

Existing domain repository interfaces remain authoritative:

```text
domain repository interface
|-- existing local implementation
`-- future authenticated Supabase implementation
```

Remote adapters accept a verified server identity context rather than a caller
chosen user ID. Local repositories and their StateReliability migration,
staging, backup, and recovery behavior remain available throughout founder
migration and rollback. Runtime switching is deferred until remote parity and
isolation are verified.

## Founder-data import contract

The future import is explicit and authenticated:

1. Create and authenticate the founder account.
2. Establish the founder profile and founder membership through a controlled
   administrative operation.
3. Import projects.
4. Import conversations.
5. Import messages and embedded workflow metadata.
6. Import memories.
7. Optionally import remaining project/studio metadata. Creative binaries stay
   in IndexedDB during v1.

The importer derives `user_id` from the authenticated founder session, retains
existing IDs where practical, uses stable import keys/upserts for retry safety,
and validates counts and relationships after each phase. It must never use a
shared placeholder UUID. Existing local data remains untouched until the
founder verifies remote parity and explicitly approves the cutover.

