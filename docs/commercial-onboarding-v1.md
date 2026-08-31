# Commercial onboarding v1

The first-launch path is an outcome flow, not a feature tour.

1. **Intent (30–75 seconds):** the founder answers “What do you want to launch?” in one free-form text field. A name is optional and voice is not required.
2. **Project (under 10 seconds plus persistence):** VAEORA derives a safe provisional title, creates one authoritative business project with the intent as its goal, keeps VAEORA Original, and confirms the project through the existing API.
3. **Direction (45–120 seconds plus the existing IAURA response):** the original intent is sent through the project-scoped conversation authority. The founder sees the existing structured result in the normal workspace.
4. **Durable value (10–30 seconds):** after a valid result, “Save this direction” persists a first-launch direction marker on the project. Mission 2 observes it as `launch_brief`; activation remains server-derived.
5. **Continue:** the workspace says “Your launch foundation is started” and presents one next best action from project facts.

Expected active interaction time is roughly 90–225 seconds, leaving normal network/AI latency inside the 3–5 minute target.

New-user entry is determined from durable product facts: the generic welcome is incomplete and there are no projects. Any existing project bypasses the modal. An interrupted commercial project carries `commercialOnboarding.source = "first-launch"`; on return, its normal project conversation and a small activation guide resume from persisted project/conversation facts. Analytics never controls access.

Retries reuse an equivalent project and reassert the same project ID. The create endpoint treats an owned duplicate ID as an idempotent success; `project_created` remains unique through its semantic event key. Failed or stale IAURA results cannot reveal the save action because the guide requires an authoritative assistant result in the active project conversation.
