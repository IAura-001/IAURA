export const IAURA_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["content", "actions"],
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
          reason: {
            type: "string",
            description:
              "Short reason why this action is useful and authorized.",
          },
        },
      },
    },
  },
} as const;
