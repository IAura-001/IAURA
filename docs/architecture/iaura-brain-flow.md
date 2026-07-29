# IAURA Brain Flow

## Status

Approved for initial implementation.

## Purpose

This document defines how IAURA processes a user request from the interface to the final response.

IAURA is not a language model.

IAURA is an intelligence system that coordinates context, memory, decisions, planning, skills, AI providers, and validation.

The language model is one component inside that system.

---

## Core Principle

The Brain does not perform every task itself.

The Brain orchestrates specialized modules.

Each module must have one clear responsibility.

---

## Official Flow

```text
User
  ↓
Chat UI
  ↓
Conversation Controller
  ↓
Brain Orchestrator
  ↓
Context Builder
  ↓
Memory Engine
  ↓
Decision Engine
  ↓
Planner
  ↓
Skill Manager
  ↓
Prompt Builder
  ↓
AI Provider
  ↓
Response Validator
  ↓
Conversation Controller
  ↓
Chat UI