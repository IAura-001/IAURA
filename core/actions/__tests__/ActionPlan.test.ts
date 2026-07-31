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
});
