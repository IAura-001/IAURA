# Measured Beta 2 operating plan

## Thesis and assignment

Primary participant: a solo founder actively launching a brand, productized service, or digital offer within approximately 30 days, without an internal brand/creative team.

Seven-day assignment: **Build a credible launch foundation in VAEORA within seven days.** Participants work on a real outcome, not random feature testing. The canonical evidence is Mission 2’s single milestone set: scoped project, confirmed audience/offer direction, saved Brand System, approved visual asset, website hero/messaging, confirmed next action, and a meaningful return session using continuity.

The commercial onboarding remains unchanged. The small Beta 2 introduction states the seven-day objective, measured nature, support route, and feedback/privacy distinction, then returns to “What do you want to launch?” No feature tour is added.

## Cohort and qualification

`beta_cohorts` distinguishes Beta 1, Beta 2, and future cohorts without becoming access or entitlement authority. `beta_cohort_participants` references Auth identities and cascades on account deletion. Beta 2 is seeded as `draft`; this mission cannot invite or remotely enable anyone.

Existing `beta_invites` gain an optional cohort link. Claiming a linked invite creates the authenticated cohort participant automatically, preserving the real invite-to-signup denominator without duplicating identity. Founder assignment also supports already-authenticated candidates. Founder review accepts at most four qualification answers:

1. What are you launching?
2. When do you intend to launch?
3. What already exists?
4. Are you actively working on it now?

Qualification remains founder/manual for the 12–15-person operating target. The number is a recruitment target, not a product limit. Existing invite claim and private-beta membership remain access authority. Cohort assignment never grants authentication, access, founder authority, or entitlement.

## Lifecycle and evidence

Participant lifecycle is `INVITED -> JOINED -> STARTED -> ACTIVATED -> RETURNING -> COMPLETED`, with `INACTIVE` derived after seven days without a meaningful session. Facts take precedence over manual state. Manual status is limited to genuinely operational inactivity.

- Joined: authenticated participant assignment tied to the existing invite/account flow.
- Started: `first_intent_submitted`.
- Activated: Mission 2’s canonical `activated` event.
- Returning: D1 or D7 meaningful-session evidence.
- Completed: `launch_foundation_completed` after all seven canonical milestones.
- D1: meaningful session on the next UTC calendar day after activation.
- D7: meaningful session on UTC day 6, 7, or 8 after activation.

Before those windows occur, retention remains false. Missing evidence is absent/unknown, never fabricated.

Abandonment states are invite-no-signup, signup-no-intent, intent-no-project, project-no-result, result-no-durable-output, activated-no-D1, D1-no-D7, and progress-stalled. No automated messaging is sent. Mission 7 uses this evidence to study return triggers.

## Founder operating surface

`/iaura/beta-2` is founder-protected by the existing active founder membership check. It provides participant status, funnel conversions, activation, median Aha, D1/D7, milestone count, last meaningful session, abandonment, AI estimated cost, unpriced operations, failures, and unresolved feedback. Existing detailed cost and legacy beta pages remain linked rather than duplicated.

Cost comes from `ai_usage_events`. Estimated cost is labeled as such; operations without reliable provider usage are counted as unpriced rather than treated as free. Cost per activated/completed participant is undefined when the denominator is zero. Project-level cost remains available through the Mission 4 `project_id` ledger boundary.

Current failure observability reliably includes AI failures. Asset-upload, project-persistence, onboarding, and entitlement-denial aggregates are marked not measurable until content-free failure events exist; zero must not be interpreted as proof of no failures.

## Feedback, support, and privacy

Product analytics remains semantic and content-free in `beta_usage_events`. Intentional participant feedback lives only in `beta_feedback`, with category (`bug`, `confusing`, `missing`, `valuable`, `other`), context kind, optional rating, optional text, structured exit answers, founder severity, and resolution state. Arbitrary feedback text never enters analytics.

The low-friction activation prompt asks whether VAEORA understood the launch (`yes`, `partly`, `no`). The participant feedback page and existing Support route provide blocker reporting without interrupting normal work. Founder severity is `BLOCKER`, `MAJOR`, `MINOR`, or `FEEDBACK`; participants need not classify severity.

End-of-week interview questions:

1. What did VAEORA remember that another AI normally loses?
2. Where did you leave VAEORA for another tool?
3. Which saved artifact was most valuable?
4. What was unclear about the next action?
5. Would losing this workspace materially slow your launch?
6. Would you pay to keep using this for another launch? (`NO`, `MAYBE`, `YES`)
7. Optional expected price and rationale.

Pricing responses are research only and never alter entitlement assignments. Founder notes use separate protected storage and never enter analytics.

The default founder CSV uses a stable cohort-scoped pseudonymous participant ID and excludes email, prompts, conversations, transcripts, feedback text, project/brand content, provider secrets, and billing data. Email remains visible only in the protected operational page where necessary.

## Success hypotheses

These are hypotheses for interpretation, not automatic pass/fail rules, especially with a 12–15-person sample:

- Signup -> first intent: 75–85%
- First intent -> project: 55–70%
- Project -> meaningful result: 65–80%
- Median Aha: under five minutes
- Activation: 45–60%
- D1: 35–50%
- D7: 20–35%
- Launch-foundation completion: 30–45%
- Activated users approving an asset: 40–60%
- First-week AI cost per activated participant: under $3
- Technical AI failure: under 3%

The existing generous `beta_default_v1` entitlement remains appropriate; no Beta 2-specific quota is introduced before observing natural qualified-user behavior.

## Mission 7 decision framework

Mission 7 must decide: Are qualified users activating, returning, and completing the outcome? What do they use most? Where do they leave VAEORA? What does activation cost? Is willingness to pay present? What allowance distribution matches observed usage? What should be removed or simplified? Is evidence sufficient to proceed toward pricing/billing?

## Manual founder review sequence

1. Verify local migrations successfully on an approved PostgreSQL/Supabase runtime.
2. Test invite claim, cohort assignment, feedback ownership, founder denial, deletion cascade, and concurrent entitlement operations.
3. Open founder Beta 2 dashboard with seeded synthetic users; verify no normal user can access it.
4. Confirm all seven milestones against persisted evidence and manually inspect D1/D7 UTC boundaries.
5. Verify cost totals against `ai_usage_events`, including unpriced and failed operations.
6. Submit each feedback category as a participant; triage and resolve it as founder.
7. Download CSV and inspect for email, prompts, project content, feedback text, transcripts, and secrets.
8. Complete onboarding on a clean account; ensure Beta messaging does not block Aha.
9. Exercise password recovery, export, and account deletion; confirm cohort/feedback/note cascades.
10. Review support ownership and operational response expectations.
11. Only after migration review, privacy/legal review, environment validation, and explicit launch approval may the cohort move from `draft` to `ready`/`active` and invitations be created.

## Launch blockers

No real invitation, remote cohort activation, deployment, or remote migration is authorized. Live database execution and concurrency verification remain blocked until an approved local runtime exists. Attorney-reviewed legal documents and a named support-response owner are required before actual users are invited.
