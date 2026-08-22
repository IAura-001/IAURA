const scopeProperties = {
  scopeType: { type: "string", enum: ["global", "project"] },
  projectId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
  expectedActiveProjectId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
  projectName: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
  currentSummary: { type: "string" },
  proposedSummary: { type: "string", minLength: 1 },
} as const;

function intelligenceProposalSchema(
  operation: string,
  properties: Record<string, unknown>,
) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["operation", ...Object.keys(scopeProperties), ...Object.keys(properties)],
    properties: {
      operation: { type: "string", enum: [operation] },
      ...scopeProperties,
      ...properties,
    },
  };
}

const recordId = { type: "string", minLength: 1 } as const;
const nullableRecordId = { anyOf: [recordId, { type: "null" }] } as const;
const expectedUpdatedAt = { type: "string", minLength: 1 } as const;
const nullableUpdatedAt = { anyOf: [expectedUpdatedAt, { type: "null" }] } as const;

const INTELLIGENCE_PROPOSAL_SCHEMA = {
  anyOf: [
    intelligenceProposalSchema("intelligence_set_direction", { recordId: nullableRecordId, expectedUpdatedAt: nullableUpdatedAt, content: { type: "string", minLength: 1 } }),
    intelligenceProposalSchema("intelligence_create_goal", { title: { type: "string", minLength: 1 } }),
    intelligenceProposalSchema("intelligence_set_goal_status", { recordId, expectedUpdatedAt, status: { type: "string", enum: ["completed", "archived"] } }),
    intelligenceProposalSchema("intelligence_create_priority", { title: nullableRecordId, goalId: nullableRecordId }),
    intelligenceProposalSchema("intelligence_reorder_priorities", {
      orderedPriorityIds: { type: "array", maxItems: 3, items: recordId },
      expectedPriorities: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["recordId", "position", "updatedAt", "label"], properties: { recordId, position: { type: "integer", minimum: 1, maximum: 3 }, updatedAt: expectedUpdatedAt, label: { type: "string", minLength: 1, maxLength: 500 } } } },
    }),
    intelligenceProposalSchema("intelligence_archive_priority", { recordId, expectedUpdatedAt }),
    intelligenceProposalSchema("intelligence_create_recurring_commitment", { title: { type: "string", minLength: 1 }, cadence: { type: "string", enum: ["daily", "weekly", "custom"] }, cadenceDetail: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] } }),
    intelligenceProposalSchema("intelligence_set_recurring_commitment_status", { recordId, expectedUpdatedAt, status: { type: "string", enum: ["active", "paused", "archived"] } }),
  ],
} as const;

export const IAURA_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
  "content",
  "actions",
  "memoryUpdates",
  "experience",
  "betaNextStep",
  "betaExecutionEvaluation",
  "betaSessionEvaluation",
],
  properties: {
    content: {
      type: "string",
      description:
        "The natural-language response shown to the user.",
    },
    actions: {
      type: "array",
      maxItems: 8,
      description:
        "Safe local IAURA actions that the application may execute.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "value",
          "description",
          "goal",
          "missionId",
          "projectKind",
          "reason",
        ],
        properties: {
          type: {
            type: "string",
            enum: [
              "add_goal",
              "remove_goal",
              "add_habit",
              "remove_habit",
              "set_user_name",
              "create_project",
              "complete_mission",
            ],
          },
          value: {
            type: "string",
            description:
              "Goal, habit, user name, or project name. Empty when unused.",
          },
          description: {
            type: "string",
            description:
              "Project description. Empty when unused.",
          },
          goal: {
            type: "string",
            description:
              "Project objective. Empty when unused.",
          },
          missionId: {
            type: "string",
            description:
              "Exact mission ID. Empty when unused.",
          },
          projectKind: {
            type: "string",
            enum: [
              "general",
              "personal",
              "business",
              "creative",
              "learning",
              "wellbeing",
            ],
            description:
              "Project classification for create_project. Use general when unused.",
          },
          reason: {
            type: "string",
            description:
              "Short reason why this action is useful and authorized.",
          },
        },
      },
    },
    memoryUpdates: {
      type: "array",
      maxItems: 6,
      description:
        "Durable memory proposals extracted from the user's real current message. Return an empty array when nothing should be remembered.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "operation",
          "type",
          "content",
          "tags",
          "reason",
          "confidence",
        ],
        properties: {
          operation: {
            type: "string",
            enum: ["remember"],
          },
          type: {
            type: "string",
            enum: [
              "profile",
              "goal",
              "habit",
              "project",
              "preference",
            ],
          },
          content: {
            type: "string",
            description:
              "A concise, durable fact stated by the user. A project memory must be an explicitly confirmed project decision, never an unaccepted assistant proposal. Do not include temporary requests, assistant conclusions, or speculative information.",
          },
          tags: {
            type: "array",
            maxItems: 8,
            items: {
              type: "string",
            },
          },
          reason: {
            type: "string",
            description:
              "Why this information is likely to remain useful in future conversations.",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description:
              "Confidence that the user explicitly stated this durable information.",
          },
        },
      },
    },
    experience: {
      type: "object",
      additionalProperties: false,
      description:
        "Adaptive visual route shown after the spoken or written response.",
      required: [
        "kind",
        "title",
        "summary",
        "phases",
        "choices",
        "recommendedSurface",
      ],
      properties: {
        kind: {
          type: "string",
          enum: [
            "personal-goal",
            "project",
            "brand",
            "creative",
            "learning",
            "wellbeing",
            "decision",
            "general",
          ],
        },
        title: {
          type: "string",
          description:
            "Short title for the route. Empty only for a trivial response.",
        },
        summary: {
          type: "string",
          description:
            "One concise sentence describing what Aura organized.",
        },
        phases: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "description"],
            properties: {
              title: {
                type: "string",
              },
              description: {
                type: "string",
              },
            },
          },
        },
        choices: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "label",
              "description",
              "prompt",
              "confirmation",
            ],
            properties: {
              label: {
                type: "string",
              },
              description: {
                type: "string",
              },
              prompt: {
                type: "string",
                description:
                  "Natural-language instruction sent back to Aura when chosen.",
              },
              confirmation: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "decision", "proposal"],
                    properties: {
                      kind: { type: "string", enum: ["intelligence-action"] },
                      decision: { type: "string", enum: ["confirm", "cancel"] },
                      proposal: INTELLIGENCE_PROPOSAL_SCHEMA,
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "content"],
                    properties: {
                      kind: {
                        type: "string",
                        enum: ["project-decision"],
                      },
                      content: {
                        type: "string",
                        minLength: 1,
                        description:
                          "Concise standalone durable project decision confirmed only if the user clicks this choice.",
                      },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "goal", "blocker", "summary"],
                    properties: {
                      kind: { type: "string", enum: ["beta-context"] },
                      goal: { type: "string", minLength: 1 },
                      blocker: { type: "string", minLength: 1 },
                      summary: { type: "string", minLength: 1 },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "outcome", "doneWhen"],
                    properties: {
                      kind: { type: "string", enum: ["beta-outcome"] },
                      outcome: { type: "string", minLength: 1 },
                      doneWhen: { type: "string", minLength: 1 },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "action", "whyNow", "result", "doneWhen"],
                    properties: {
                      kind: { type: "string", enum: ["beta-next-step"] },
                      action: { type: "string", minLength: 1 },
                      whyNow: { type: "string", minLength: 1 },
                      result: { type: "string", minLength: 1 },
                      doneWhen: { type: "string", minLength: 1 },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "decision"],
                    properties: {
                      kind: { type: "string", enum: ["beta-session-decision"] },
                      decision: {
                        type: "string",
                        enum: ["start-now", "continue-later"],
                      },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "result", "observation", "doneWhenSatisfied"],
                    properties: {
                      kind: { type: "string", enum: ["beta-execution-evaluation"] },
                      result: { type: "string", enum: ["passed", "failed", "partial"] },
                      observation: { type: "string", minLength: 1 },
                      doneWhenSatisfied: { type: "boolean" },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "outcomeSatisfied", "summary"],
                    properties: {
                      kind: { type: "string", enum: ["beta-session-evaluation"] },
                      outcomeSatisfied: { type: "boolean" },
                      summary: { type: "string", minLength: 1 },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "decision"],
                    properties: {
                      kind: {
                        type: "string",
                        enum: ["beta-incomplete-execution-recovery"],
                      },
                      decision: {
                        type: "string",
                        enum: ["retry-now", "retry-later"],
                      },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind"],
                    properties: {
                      kind: { type: "string", enum: ["beta-session-closure"] },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "decision"],
                    properties: {
                      kind: { type: "string", enum: ["beta-post-closure-handoff"] },
                      decision: {
                        type: "string",
                        enum: ["finish-here", "begin-another-cycle"],
                      },
                    },
                  },
                  {
                    type: "null",
                  },
                ],
                description:
                  "Required on every choice. Use a project-decision object only for an explicit selectable durable project decision; use null for every ordinary choice.",
              },
            },
          },
        },
        recommendedSurface: {
          type: "string",
          enum: [
            "none",
            "presence",
            "projects",
            "intelligence",
            "creative-direction",
            "creative-image",
            "creative-website",
            "creative-library",
            "launch",
          ],
          description:
            "Best optional application surface for the next step.",
        },
      },
    },
    betaNextStep: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["action", "whyNow", "result", "doneWhen"],
          properties: {
            action: {
              type: "string",
              minLength: 1,
              description: "The single concrete action the founder should begin next.",
            },
            whyNow: {
              type: "string",
              minLength: 1,
              description: "Why this is the highest-priority next step now.",
            },
            result: {
              type: "string",
              minLength: 1,
              description: "The concrete result this action should produce.",
            },
            doneWhen: {
              type: "string",
              minLength: 1,
              description: "The observable criterion that verifies completion.",
            },
          },
        },
        { type: "null" },
      ],
      description:
        "Exactly one Beta 01 next-step proposal when confirmed context and confirmed outcome exist; otherwise null.",
    },
    betaExecutionEvaluation: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["result", "observation", "doneWhenSatisfied"],
          properties: {
            result: { type: "string", enum: ["passed", "failed", "partial"] },
            observation: { type: "string", minLength: 1 },
            doneWhenSatisfied: { type: "boolean" },
          },
        },
        { type: "null" },
      ],
      description:
        "Provisional interpretation of a founder execution report while Beta workflow status is started; otherwise null.",
    },
    betaSessionEvaluation: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["outcomeSatisfied", "summary"],
          properties: {
            outcomeSatisfied: { type: "boolean" },
            summary: { type: "string", minLength: 1 },
          },
        },
        { type: "null" },
      ],
      description:
        "Provisional session-level evaluation while the trusted Beta workflow status is evaluated; otherwise null.",
    },
  },
} as const;
