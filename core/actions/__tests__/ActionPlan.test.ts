import { describe, expect, it } from "vitest";

import { parseAuraAssistantPlan } from "../ActionPlan";

describe("ActionPlan", () => {
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
});
