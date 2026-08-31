# Product activation metrics v1

All funnel events use authenticated internal user IDs, server timestamps, schema version `1`, and allowlisted semantic metadata. Prompt text, assistant output, transcripts, image data, filenames, and arbitrary project content are prohibited.

- **Signup completed:** `auth.users.created_at`; no duplicate event is stored.
- **First intent:** the first non-empty user-initiated IAURA send attempt. The semantic key is user-global, so retries and React rerenders deduplicate. Entry point, existing project scope, and text/voice mode are the only metadata.
- **Project created:** a successful durable project insert, once per project. Hydration and failed inserts do not count.
- **Project-scoped result:** a successful, non-stale conversation result whose requested project remains authoritative when applied. Generic chat, failures, aborted and cross-project responses do not count.
- **Durable output:** a confirmed next action or a qualifying artifact observed after the project update succeeds: saved first-launch brief/direction, audience/offer direction, brand direction, applied Brand System, approved visual asset, saved website messaging, or approved launch material. Previews and panel opens never qualify.
- **Activation:** a project exists and matching project-scoped-result plus durable-output events exist for the same user, project, and browser session. It is derived server-side with the unique key `activated:first`, so it can occur at most once per user.
- **Time to Aha:** server event timestamps provide signup → intent → project → result → durable output → activation intervals. The primary metric is first intent → activation; signup → activation is retained for acquisition analysis.
- **Meaningful session:** a browser session containing a project open/create, first intent, project result, durable output, or confirmed beta step. Login/static loads, polling, and background refreshes do not count. One semantic row is stored per session.
- **D1:** a meaningful session on the next UTC calendar day after activation. **D7:** one on UTC day 6, 7, or 8 after activation, tolerating normal weekly-use timing.
- **Launch foundation:** persisted milestones are scoped project/result, audience + offer direction, Brand System, approved visual asset, website messaging, confirmed next action, and a post-activation return session. Completion is derived only when all seven exist. Brand direction and launch material are tracked as additional durable outputs but are not substituted for required milestones.
- **Abandonment:** absence between ordered first-event timestamps identifies signup/no intent, intent/no project, project/no result, result/no durable output, and next-action/no return. Repeated legacy `message_sent` rows without durable output identify chat-only behavior. Image generation and early export cannot yet be measured reliably without adding content-adjacent instrumentation; these remain explicit gaps.
- **Cost:** existing `ai_usage_events` remains authoritative. Cost per signup/activated/completed user is joined by authenticated `user_id` and bounded event timestamps. Per-project cost is a known gap because authoritative cost rows currently lack `project_id`; cost data is not duplicated.

The existing founder operations endpoint remains founder-authorized. Its activation label and median now use the canonical derived activation event. A larger funnel dashboard is deliberately deferred; database events and the protected endpoint are the reporting foundation.
