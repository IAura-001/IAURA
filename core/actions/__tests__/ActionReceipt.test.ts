import { describe, expect, it } from "vitest";

import { formatActionReceipt } from "../ActionReceipt";
import type { ActionExecutionItem } from "../types";

describe("ActionReceipt", () => {
  it("separates executed and skipped changes", () => {
    const items: ActionExecutionItem[] = [
      {
        type: "add_goal",
        status: "executed",
        summary: "Meta creada: Dormir mejor",
        reason: "El usuario lo pidió.",
      },
      {
        type: "add_habit",
        status: "skipped",
        summary:
          "Hábito ya existente: Caminar",
        reason:
          "IAURA evita hábitos duplicados.",
      },
    ];

    const receipt = formatActionReceipt(items);

    expect(receipt).toContain(
      "✓ Meta creada: Dormir mejor"
    );
    expect(receipt).toContain(
      "Cambios no aplicados:"
    );
    expect(receipt).toContain(
      "IAURA evita hábitos duplicados."
    );
  });

  it("returns no receipt when no action was planned", () => {
    expect(formatActionReceipt([])).toBe("");
  });
});
