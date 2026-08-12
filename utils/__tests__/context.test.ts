import { describe, expect, it } from "vitest";
import { DEFAULT_MEMORY } from "@/constants/memory";
import { buildUserContext } from "../context";

describe("buildUserContext", () => {
  it("includes the user's preferred language", () => {
    const context = buildUserContext({
      ...DEFAULT_MEMORY,
      preferredLocale: "pt-BR",
    });

    expect(context).toContain(
      "Preferred Language: Brazilian Portuguese (pt-BR)"
    );
  });

  it("serializes goals and habits as global personal intelligence", () => {
    const context = buildUserContext({
      ...DEFAULT_MEMORY,
      goals: ["Launch an IAURA beta"],
      habits: ["Work daily on IAURA / VAEORA"],
      activeProject: null,
    });

    expect(context).toContain(
      "PERSONAL INTELLIGENCE — GLOBAL USER CONTEXT",
    );
    expect(context).toContain("- Launch an IAURA beta");
    expect(context).toContain("- Work daily on IAURA / VAEORA");
    expect(context).toContain(
      "Goals and habits may reference a project as a personal intention or relationship.",
    );
    expect(context).toContain(
      "They are not evidence of the active project's goal, status, implementation, development continuity, or capabilities.",
    );
  });
});
