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

  it("excludes unscoped free text and mission progress from global model context", () => {
    const context = buildUserContext({
      ...DEFAULT_MEMORY,
      goals: ["Launch an IAURA beta"],
      habits: ["Work daily on IAURA / VAEORA"],
      projects: ["IAURA"],
      completedMissionIds: ["iaura-beta-01"],
      activeProject: null,
    });

    expect(context).toContain(
      "PERSONAL INTELLIGENCE — GLOBAL USER CONTEXT",
    );
    expect(context).not.toContain("Launch an IAURA beta");
    expect(context).not.toContain("Work daily on IAURA / VAEORA");
    expect(context).not.toContain("iaura-beta-01");
    expect(context).not.toContain("Available Missions:");
    expect(context).toContain("Level: 1");
    expect(context).toContain("XP: 0");
    expect(context).toContain("Streak: 0");
  });
});
