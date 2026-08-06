export const IAURA_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
  "content",
  "actions",
  "memoryUpdates",
  "experience",
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
              "A concise, durable fact stated by the user. Do not include temporary requests, assistant conclusions, or speculative information.",
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
  },
} as const;