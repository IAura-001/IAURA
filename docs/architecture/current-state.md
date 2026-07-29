# IAURA Current Architecture State

## Status Legend

- Completed: implemented, connected, and documented
- Implemented: code exists but is not fully connected
- Planned: not implemented yet
- Refactor: currently being reorganized

---

## Core Intelligence

| Module | Status | Notes |
|---|---|---|
| Brain Orchestrator | Implemented | Coordinates context, decisions, prompt creation, and validation |
| Context Builder | Implemented | Builds structured request context |
| Decision Engine | Implemented | Selects an IAURA thinking mode |
| Prompt Builder | Implemented | Builds IAURA identity-aware prompts |
| Response Validator | Implemented | Performs initial structural validation |
| Memory Engine | Planned | Folder exists, implementation pending |
| Planner | Planned | Folder exists, implementation pending |
| Skill Manager | Planned | Folder exists, implementation pending |
| Tool Engine | Planned | Folder exists, implementation pending |
| Personality Module | Planned | Identity currently lives inside Prompt Builder |

---

## Provider Layer

| Module | Status | Notes |
|---|---|---|
| AI Provider Contract | Implemented | Provider-independent interface |
| OpenAI Provider | Completed | OpenAI SDK exists only in the provider implementation |
| API Route | Completed | Delegates generation to the OpenAI Provider |
| Frontend AI Service | Implemented | Calls the internal `/api/chat` route |
| Additional Providers | Planned | Anthropic, Google, local, or IAURA-owned models |

---

## Interface Layer

| Module | Status | Notes |
|---|---|---|
| Chat UI | Implemented | Displays user and assistant messages |
| Conversation State | Implemented | Stores the current browser conversation |
| Conversation Controller | Planned | Logic currently remains inside `page.tsx` |
| Loading State | Planned | Required before complete integration |
| Streaming | Planned | Future enhancement |
| Cancellation | Planned | Future enhancement |

---

## Current Request Flow

```text
Client
  ↓
services/openai.ts
  ↓
POST /api/chat
  ↓
OpenAIProvider
  ↓
OpenAI
  ↓
API response