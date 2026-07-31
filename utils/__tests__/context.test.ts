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
});
