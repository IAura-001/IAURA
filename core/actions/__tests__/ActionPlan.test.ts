import { describe, expect, it } from "vitest";

import { parseAuraAssistantPlan } from "../ActionPlan";
import { IAURA_RESPONSE_SCHEMA } from "../schema";

function choiceSchema() {
  return IAURA_RESPONSE_SCHEMA.properties.experience.properties.choices
    .items;
}

describe("ActionPlan", () => {
  it("requires confirmation and restricts it to a closed project-decision object or null", () => {
    const schema = choiceSchema();

    expect(schema.required).toContain("confirmation");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.confirmation.anyOf).toEqual([
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind", "content"],
        properties: expect.objectContaining({
          kind: expect.objectContaining({ enum: ["project-decision"] }),
          content: expect.objectContaining({ minLength: 1 }),
        }),
      }),
      { type: "null" },
    ]);
    const objectProperties =
      schema.properties.confirmation.anyOf[0].properties;
    expect(objectProperties).not.toHaveProperty("projectId");
    expect(objectProperties).not.toHaveProperty("scope");
    expect(objectProperties).not.toHaveProperty("tags");
  });

  it("parses a valid structured response", () => {
    const plan = parseAuraAssistantPlan({
      content: "Preparé tu nueva meta.",
      actions: [
        {
          type: "add_goal",
          value: "Dormir mejor",
          description: "",
          goal: "",
          missionId: "",
          reason: "El usuario lo pidió.",
        },
      ],
    });

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].type).toBe(
      "add_goal"
    );
  });

  it("discards unsupported actions", () => {
    const plan = parseAuraAssistantPlan({
      content: "Necesito tu autorización.",
      actions: [
        {
          type: "make_payment",
          value: "100",
        },
      ],
    });

    expect(plan.actions).toEqual([]);
  });

  it("parses an adaptive route with phases, choices and a destination", () => {
    const plan = parseAuraAssistantPlan({
      content: "Organicé una ruta para tu nueva meta.",
      actions: [],
      experience: {
        kind: "personal-goal",
        title: "Recuperar tu energía",
        summary: "Una ruta gradual y sostenible.",
        phases: [
          {
            title: "Entender",
            description: "Detectar qué está drenando tu energía.",
          },
          {
            title: "Diseñar",
            description: "Elegir un cambio pequeño y medible.",
          },
        ],
        choices: [
          {
            label: "Empezar por hábitos",
            description: "Revisar sueño, movimiento y alimentación.",
            prompt: "Quiero empezar revisando mis hábitos actuales.",
          },
        ],
        recommendedSurface: "intelligence",
      },
    });

    expect(plan.experience.kind).toBe("personal-goal");
    expect(plan.experience.phases).toHaveLength(2);
    expect(plan.experience.choices[0].prompt).toContain("hábitos");
    expect(plan.experience.recommendedSurface).toBe("intelligence");
  });

  it("uses a safe empty experience when an older response has none", () => {
    const plan = parseAuraAssistantPlan({
      content: "Respuesta compatible.",
      actions: [],
    });

    expect(plan.experience).toEqual({
      kind: "general",
      title: "",
      summary: "",
      phases: [],
      choices: [],
      recommendedSurface: "none",
    });
  });

  it("preserves valid optional project-decision confirmation metadata", () => {
    const plan = parseAuraAssistantPlan({
      content: "Choose the beta audience.",
      actions: [],
      experience: {
        kind: "decision",
        title: "Beta audience",
        summary: "Choose one audience.",
        phases: [],
        choices: [
          {
            label: "Founders",
            description: "Founders building digital products.",
            prompt: "Continue with founders as the beta audience.",
            confirmation: {
              kind: "project-decision",
              content: "  The beta audience is founders.  ",
              projectId: "hostile-project",
            },
          },
        ],
        recommendedSurface: "presence",
      },
    });

    expect(plan.experience.choices[0].confirmation).toEqual({
      kind: "project-decision",
      content: "The beta audience is founders.",
    });
    expect(plan.experience.choices[0].confirmation).not.toHaveProperty(
      "projectId",
    );
  });

  it("discards empty or invalid confirmation while preserving the choice", () => {
    const plan = parseAuraAssistantPlan({
      content: "Keep exploring.",
      actions: [],
      experience: {
        kind: "general",
        title: "Explore",
        summary: "No confirmation yet.",
        phases: [],
        choices: [
          {
            label: "Tell me more",
            description: "Continue exploring.",
            prompt: "Tell me more.",
            confirmation: {
              kind: "navigation",
              content: "   ",
            },
          },
        ],
        recommendedSurface: "none",
      },
    });

    expect(plan.experience.choices[0].prompt).toBe("Tell me more.");
    expect(plan.experience.choices[0].confirmation).toBeUndefined();
  });

  it("normalizes schema-valid confirmation null to existing downstream behavior", () => {
    const plan = parseAuraAssistantPlan({
      content: "Continue exploring.",
      actions: [],
      memoryUpdates: [],
      experience: {
        kind: "general",
        title: "Explore",
        summary: "Review the options.",
        phases: [],
        choices: [
          {
            label: "Tell me more",
            description: "Keep exploring.",
            prompt: "Tell me more about the options.",
            confirmation: null,
          },
        ],
        recommendedSurface: "none",
      },
    });

    expect(plan.experience.choices[0]).toEqual({
      label: "Tell me more",
      description: "Keep exploring.",
      prompt: "Tell me more about the options.",
    });
  });
});
