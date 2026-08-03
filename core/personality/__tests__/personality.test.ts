import { describe, expect, it } from "vitest";

import {
  IAURA_CONSTITUTION,
  IAURA_IDENTITY,
  IAURA_REASONING,
  IAURA_SYSTEM_PROMPT,
  IAURA_TONE,
} from "../index";

const OFFICIAL_MODULES = [
  IAURA_CONSTITUTION,
  IAURA_IDENTITY,
  IAURA_REASONING,
  IAURA_TONE,
];

function countOccurrences(source: string, value: string): number {
  return source.split(value).length - 1;
}

describe("IAURA official personality", () => {
  it("composes every official module exactly once and in order", () => {
    for (const personalityModule of OFFICIAL_MODULES) {
      expect(
        countOccurrences(IAURA_SYSTEM_PROMPT, personalityModule),
      ).toBe(1);
    }

    const positions = OFFICIAL_MODULES.map((personalityModule) =>
      IAURA_SYSTEM_PROMPT.indexOf(personalityModule),
    );

    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it("does not export an empty personality module", () => {
    for (const personalityModule of OFFICIAL_MODULES) {
      expect(personalityModule.trim().length).toBeGreaterThan(0);
    }
  });
});
