import { describe, expect, it } from "vitest";

import { parseAuraAssistantPlan } from "../ActionPlan";
import { IAURA_RESPONSE_SCHEMA } from "../schema";

function choiceSchema() {
  return IAURA_RESPONSE_SCHEMA.properties.experience.properties.choices
    .items;
}

describe("ActionPlan", () => {
  it("defines one nullable closed next-step object with all four required fields", () => {
    const schema = IAURA_RESPONSE_SCHEMA.properties.betaNextStep;
    const recommendation = schema.anyOf[0];

    expect(IAURA_RESPONSE_SCHEMA.required).toContain("betaNextStep");
    expect(IAURA_RESPONSE_SCHEMA.required).toContain("betaExecutionEvaluation");
    expect(IAURA_RESPONSE_SCHEMA.required).toContain("betaSessionEvaluation");
    expect(recommendation).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["action", "whyNow", "result", "doneWhen"],
    });
    expect(schema.anyOf).toHaveLength(2);
    expect(schema.anyOf[1]).toEqual({ type: "null" });
  });

  it("parses one complete recommendation and normalizes its fields", () => {
    const plan = parseAuraAssistantPlan({
      content: "Here is the next step.",
      betaNextStep: {
        action: "  Build the first card. ",
        whyNow: " Context and outcome are confirmed. ",
        result: " One prioritized action is visible. ",
        doneWhen: " The card survives reload. ",
      },
    });

    expect(plan.betaNextStep).toEqual({
      action: "Build the first card.",
      whyNow: "Context and outcome are confirmed.",
      result: "One prioritized action is visible.",
      doneWhen: "The card survives reload.",
    });
  });

  it.each([
    { action: "Act", whyNow: "Now", result: "Result" },
    { action: "   ", whyNow: "Now", result: "Result", doneWhen: "Visible" },
    [{ action: "One", whyNow: "Now", result: "One", doneWhen: "Done" }],
  ])("rejects incomplete, empty, or multiple recommendation shapes", (betaNextStep) => {
    const plan = parseAuraAssistantPlan({ content: "Continue.", betaNextStep });
    expect(plan.betaNextStep).toBeUndefined();
  });

  it("requires confirmation and restricts all confirmation variants to closed objects", () => {
    const schema = choiceSchema();

    expect(schema.required).toContain("confirmation");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.confirmation.anyOf).toEqual([
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind", "decision", "proposal"],
      }),
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind", "content"],
        properties: expect.objectContaining({
          kind: expect.objectContaining({ enum: ["project-decision"] }),
          content: expect.objectContaining({ minLength: 1 }),
        }),
      }),
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind", "goal", "blocker", "summary"],
      }),
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind", "outcome", "doneWhen"],
      }),
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind", "action", "whyNow", "result", "doneWhen"],
      }),
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind", "decision"],
      }),
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind", "result", "observation", "doneWhenSatisfied"],
      }),
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind", "outcomeSatisfied", "summary"],
      }),
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind", "decision"],
        properties: expect.objectContaining({
          kind: expect.objectContaining({ enum: ["beta-incomplete-execution-recovery"] }),
          decision: expect.objectContaining({ enum: ["retry-now", "retry-later"] }),
        }),
      }),
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind"],
      }),
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
        required: ["kind", "decision"],
      }),
      { type: "null" },
    ]);
    const objectProperties =
      schema.properties.confirmation.anyOf[1].properties;
    expect(objectProperties).not.toHaveProperty("projectId");
    expect(objectProperties).not.toHaveProperty("scope");
    expect(objectProperties).not.toHaveProperty("tags");
  });

  it("parses a narrow Intelligence proposal and rejects invalid global scope authority", () => {
    const proposal = {
      operation: "intelligence_create_goal", scopeType: "global", projectId: null,
      expectedActiveProjectId: null, projectName: null, currentSummary: "None",
      proposedSummary: "Goal: Finish v2", title: "Finish v2",
    };
    const plan = parseAuraAssistantPlan({ content: "Review", experience: {
      kind: "decision", title: "Goal", summary: "Review", phases: [], recommendedSurface: "intelligence",
      choices: [{ label: "Confirm", description: "Create", prompt: "Confirm", confirmation: {
        kind: "intelligence-action", decision: "confirm", proposal,
      } }],
    } });
    expect(plan.experience.choices[0].confirmation).toEqual({
      kind: "intelligence-action", decision: "confirm", proposal,
    });

    const hostileAuthority = parseAuraAssistantPlan({ content: "Review", experience: {
      kind: "decision", title: "Goal", summary: "Review", phases: [], recommendedSurface: "intelligence",
      choices: [{ label: "Confirm", description: "Create", prompt: "Confirm", confirmation: {
        kind: "intelligence-action", decision: "confirm",
        proposal: { ...proposal, executionId: "70000000-0000-4000-8000-000000000099" },
      } }],
    } });
    expect((hostileAuthority.experience.choices[0].confirmation as { proposal: { executionId?: string } }).proposal.executionId)
      .toBeUndefined();

    const invalid = parseAuraAssistantPlan({ content: "Review", experience: {
      kind: "decision", title: "Goal", summary: "Review", phases: [], recommendedSurface: "intelligence",
      choices: [{ label: "Confirm", description: "Create", prompt: "Confirm", confirmation: {
        kind: "intelligence-action", decision: "confirm", proposal: { ...proposal, projectId: "hostile-project" },
      } }],
    } });
    expect(invalid.experience.choices[0].confirmation).toBeUndefined();
  });

  it("rejects malformed or mismatched canonical Intelligence references", () => {
    const base = {
      operation: "intelligence_set_goal_status", scopeType: "global", projectId: null,
      expectedActiveProjectId: null, projectName: null, currentSummary: "Active goal",
      proposedSummary: "Complete goal", status: "completed",
      recordId: "not-a-uuid", expectedUpdatedAt: "not-a-timestamp",
    };
    const parse = (proposal: object) => parseAuraAssistantPlan({ content: "Review", experience: {
      kind: "decision", title: "Goal", summary: "Review", phases: [], recommendedSurface: "intelligence",
      choices: [{ label: "Confirm", description: "Apply", prompt: "Confirm", confirmation: {
        kind: "intelligence-action", decision: "confirm", proposal,
      } }],
    } }).experience.choices[0].confirmation;

    expect(parse(base)).toBeUndefined();
    expect(parse({ ...base, recordId: "00000000-0000-4000-8000-000000000001", expectedUpdatedAt: "still-not-a-timestamp" }))
      .toBeUndefined();
  });

  it.each(["start-now", "continue-later"] as const)(
    "parses beta session decision %s and strips trusted fields",
    (decision) => {
      const plan = parseAuraAssistantPlan({ content: "Choose.", experience: {
        kind: "decision", title: "Session", summary: "Choose", phases: [],
        choices: [{ label: "Choose", description: "Choose", prompt: "Continue", confirmation: {
          kind: "beta-session-decision", decision,
          sourceMessageId: "hostile", decidedAt: "hostile", projectId: "hostile",
        } }], recommendedSurface: "presence",
      } });
      expect(plan.experience.choices[0].confirmation).toEqual({
        kind: "beta-session-decision", decision,
      });
    },
  );

  it("rejects an unsupported beta session decision", () => {
    const plan = parseAuraAssistantPlan({ content: "Choose.", experience: {
      kind: "decision", title: "Session", summary: "Choose", phases: [],
      choices: [{ label: "Choose", description: "Choose", prompt: "Continue", confirmation: {
        kind: "beta-session-decision", decision: "completed",
      } }], recommendedSurface: "presence",
    } });
    expect(plan.experience.choices[0].confirmation).toBeUndefined();
  });

  it.each(["retry-now", "retry-later"] as const)(
    "parses incomplete-execution recovery %s and strips trusted fields",
    (decision) => {
      const plan = parseAuraAssistantPlan({ content: "Recover.", experience: {
        kind: "decision", title: "Recovery", summary: "Choose", phases: [],
        choices: [{ label: "Choose", description: "Choose", prompt: "Continue", confirmation: {
          kind: "beta-incomplete-execution-recovery", decision,
          evidenceId: "hostile", sourceMessageId: "hostile", confirmedAt: "hostile",
        } }], recommendedSurface: "presence",
      } });
      expect(plan.experience.choices[0].confirmation).toEqual({
        kind: "beta-incomplete-execution-recovery", decision,
      });
    },
  );

  it("rejects an unknown incomplete-execution recovery decision", () => {
    const plan = parseAuraAssistantPlan({ content: "Recover.", experience: {
      kind: "decision", title: "Recovery", summary: "Choose", phases: [],
      choices: [{ label: "Choose", description: "Choose", prompt: "Continue", confirmation: {
        kind: "beta-incomplete-execution-recovery", decision: "replace-step",
      } }], recommendedSurface: "presence",
    } });
    expect(plan.experience.choices[0].confirmation).toBeUndefined();
  });

  it("parses a provisional execution evaluation and strips trusted fields", () => {
    const plan = parseAuraAssistantPlan({
      content: "Review this evidence.",
      betaExecutionEvaluation: {
        result: "partial",
        observation: "  The card rendered but the action failed. ",
        doneWhenSatisfied: false,
        evidenceId: "model-id",
        sourceMessageId: "model-source",
        verifiedAt: "model-time",
        projectId: "model-project",
      },
      experience: {
        kind: "decision", title: "Evidence", summary: "Review", phases: [],
        choices: [{
          label: "Confirmar evaluación", description: "Confirm", prompt: "Continue",
          confirmation: {
            kind: "beta-execution-evaluation", result: "partial",
            observation: "The card rendered but the action failed.",
            doneWhenSatisfied: false, evidenceId: "model-id", verifiedAt: "model-time",
          },
        }], recommendedSurface: "presence",
      },
    });

    expect(plan.betaExecutionEvaluation).toEqual({
      result: "partial",
      observation: "The card rendered but the action failed.",
      doneWhenSatisfied: false,
    });
    expect(plan.experience.choices[0].confirmation).toEqual({
      kind: "beta-execution-evaluation",
      result: "partial",
      observation: "The card rendered but the action failed.",
      doneWhenSatisfied: false,
    });
  });

  it.each([
    { result: "passed", observation: "Done" },
    { result: "unknown", observation: "Done", doneWhenSatisfied: true },
    { result: "failed", observation: " ", doneWhenSatisfied: false },
    [{ result: "passed", observation: "Done", doneWhenSatisfied: true }],
  ])("rejects malformed provisional execution evaluation", (evaluation) => {
    expect(parseAuraAssistantPlan({
      content: "Review.",
      betaExecutionEvaluation: evaluation,
    }).betaExecutionEvaluation).toBeUndefined();
  });

  it("parses provisional session evaluation and typed confirmations without trusted fields", () => {
    const plan = parseAuraAssistantPlan({
      content: "Review the session.",
      betaSessionEvaluation: {
        outcomeSatisfied: true, summary: "  Outcome is visible. ",
        sourceMessageId: "model", confirmedAt: "model", closedAt: "model",
      },
      experience: {
        kind: "decision", title: "Session", summary: "Review", phases: [],
        choices: [
          { label: "Confirm", description: "Confirm", prompt: "Continue", confirmation: {
            kind: "beta-session-evaluation", outcomeSatisfied: true,
            summary: "Outcome is visible.", sourceMessageId: "model", confirmedAt: "model",
          } },
          { label: "Close", description: "Close", prompt: "Close", confirmation: {
            kind: "beta-session-closure", sourceMessageId: "model", closedAt: "model", status: "closed",
          } },
        ], recommendedSurface: "presence",
      },
    });
    expect(plan.betaSessionEvaluation).toEqual({
      outcomeSatisfied: true, summary: "Outcome is visible.",
    });
    expect(plan.experience.choices[0].confirmation).toEqual({
      kind: "beta-session-evaluation", outcomeSatisfied: true,
      summary: "Outcome is visible.",
    });
    expect(plan.experience.choices[1].confirmation).toEqual({ kind: "beta-session-closure" });
  });

  it.each([
    { summary: "Missing boolean" },
    { outcomeSatisfied: "yes", summary: "Wrong boolean" },
    { outcomeSatisfied: false, summary: "  " },
    [{ outcomeSatisfied: true, summary: "Array" }],
  ])("rejects malformed provisional session evaluation", (evaluation) => {
    expect(parseAuraAssistantPlan({
      content: "Review.", betaSessionEvaluation: evaluation,
    }).betaSessionEvaluation).toBeUndefined();
  });

  it.each(["finish-here", "begin-another-cycle"] as const)(
    "parses post-closure handoff %s without trusted fields",
    (decision) => {
      const plan = parseAuraAssistantPlan({ content: "Choose.", experience: {
        kind: "decision", title: "Closed", summary: "Choose", phases: [],
        choices: [{ label: "Choose", description: "Choose", prompt: "Continue",
          confirmation: { kind: "beta-post-closure-handoff", decision,
            sourceMessageId: "injected", confirmedAt: "injected" } }],
        recommendedSurface: "presence",
      } });
      expect(plan.experience.choices[0].confirmation).toEqual({
        kind: "beta-post-closure-handoff", decision,
      });
    },
  );

  it.each([undefined, "restart", "finish"])(
    "rejects malformed post-closure handoff decision %s",
    (decision) => {
      const plan = parseAuraAssistantPlan({ content: "Choose.", experience: {
        kind: "decision", title: "Closed", summary: "Choose", phases: [],
        choices: [{ label: "Choose", description: "Choose", prompt: "Continue",
          confirmation: { kind: "beta-post-closure-handoff", decision } }],
        recommendedSurface: "presence",
      } });
      expect(plan.experience.choices[0].confirmation).toBeUndefined();
    },
  );

  it("parses complete beta-next-step confirmation and strips trusted fields", () => {
    const plan = parseAuraAssistantPlan({
      content: "Confirm it.",
      experience: {
        kind: "decision", title: "Next", summary: "One step", phases: [],
        choices: [{
          label: "Confirmar siguiente paso", description: "Use it", prompt: "Continue",
          confirmation: {
            kind: "beta-next-step", action: "Build", whyNow: "Now",
            result: "Card", doneWhen: "Visible", sourceMessageId: "hostile",
            confirmedAt: "hostile", projectId: "hostile",
          },
        }], recommendedSurface: "presence",
      },
    });

    expect(plan.experience.choices[0].confirmation).toEqual({
      kind: "beta-next-step", action: "Build", whyNow: "Now",
      result: "Card", doneWhen: "Visible",
    });
  });

  it.each([
    { kind: "beta-next-step", action: "Build", whyNow: "Now", result: "Card" },
    { kind: "beta-next-step", action: " ", whyNow: "Now", result: "Card", doneWhen: "Visible" },
    [{ kind: "beta-next-step", action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible" }],
    { kind: "beta-next-steps", action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible" },
  ])("rejects invalid beta-next-step confirmation metadata", (confirmation) => {
    const plan = parseAuraAssistantPlan({
      content: "Adjust.", experience: {
        kind: "decision", title: "Next", summary: "Review", phases: [],
        choices: [{ label: "Adjust", description: "Change", prompt: "Adjust", confirmation }],
        recommendedSurface: "presence",
      },
    });
    expect(plan.experience.choices[0].confirmation).toBeUndefined();
  });

  it("parses valid beta context and outcome confirmations without scope fields", () => {
    const plan = parseAuraAssistantPlan({
      content: "Confirm the session.",
      actions: [],
      memoryUpdates: [],
      experience: {
        kind: "decision",
        title: "Session",
        summary: "Confirm the proposal.",
        phases: [],
        choices: [
          {
            label: "Confirm context",
            description: "Continue.",
            prompt: "Continue with this context.",
            confirmation: {
              kind: "beta-context",
              goal: "Launch the beta",
              blocker: "The next step is unclear",
              summary: "Clarify the launch path",
              projectId: "hostile",
              sourceMessageId: "hostile",
            },
          },
          {
            label: "Confirm outcome",
            description: "Define it.",
            prompt: "Continue with this outcome.",
            confirmation: {
              kind: "beta-outcome",
              outcome: "A one-sentence value proposition",
              doneWhen: "It names user, problem and benefit",
              confirmedAt: "hostile",
            },
          },
        ],
        recommendedSurface: "presence",
      },
    });

    expect(plan.experience.choices[0].confirmation).toEqual({
      kind: "beta-context",
      goal: "Launch the beta",
      blocker: "The next step is unclear",
      summary: "Clarify the launch path",
    });
    expect(plan.experience.choices[1].confirmation).toEqual({
      kind: "beta-outcome",
      outcome: "A one-sentence value proposition",
      doneWhen: "It names user, problem and benefit",
    });
  });

  it("discards incomplete beta confirmations while preserving their choices", () => {
    const plan = parseAuraAssistantPlan({
      content: "Adjust the proposal.",
      actions: [],
      memoryUpdates: [],
      experience: {
        kind: "decision",
        title: "Adjust",
        summary: "Incomplete confirmation.",
        phases: [],
        choices: [{
          label: "Adjust",
          description: "Correct it.",
          prompt: "Adjust the context.",
          confirmation: { kind: "beta-context", goal: "", blocker: "x", summary: "y" },
        }],
        recommendedSurface: "presence",
      },
    });

    expect(plan.experience.choices[0].confirmation).toBeUndefined();
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

  it("preserves a validated reorder snapshot with canonical display labels", () => {
    const firstId = "00000000-0000-4000-8000-000000000001";
    const secondId = "00000000-0000-4000-8000-000000000002";
    const proposal = {
      operation: "intelligence_reorder_priorities",
      scopeType: "global",
      projectId: null,
      expectedActiveProjectId: null,
      projectName: null,
      currentSummary: "Current priorities",
      proposedSummary: "Proposed priorities",
      orderedPriorityIds: [secondId, firstId],
      expectedPriorities: [
        { recordId: firstId, position: 1, updatedAt: "2026-08-21T00:00:00Z", label: "Finish Intelligence v2" },
        { recordId: secondId, position: 2, updatedAt: "2026-08-21T00:00:01Z", label: "Train consistently" },
      ],
    };
    const plan = parseAuraAssistantPlan({
      content: "Confirm the reorder.",
      experience: {
        kind: "decision",
        title: "Reorder global priorities",
        summary: "Confirm the exact order.",
        phases: [],
        choices: [
          { label: "Confirm", description: "Apply", prompt: "Confirm", confirmation: { kind: "intelligence-action", decision: "confirm", proposal } },
          { label: "Cancel", description: "Keep", prompt: "Cancel", confirmation: { kind: "intelligence-action", decision: "cancel", proposal } },
        ],
        recommendedSurface: "presence",
      },
    });

    expect(plan.experience.choices).toHaveLength(2);
    expect(plan.experience.choices[0].confirmation).toMatchObject({
      kind: "intelligence-action",
      decision: "confirm",
      proposal: { operation: "intelligence_reorder_priorities", expectedPriorities: proposal.expectedPriorities },
    });
  });
});
