import { describe, expect, it } from "vitest";
import { MemoryEngine } from "../MemoryEngine";
import { MemoryType } from "../MemoryTypes";

describe("MemoryEngine", () => {
  it("adds a memory", () => {
    const engine = new MemoryEngine();

    engine.add(
      MemoryType.GOAL,
      "Become an AI Engineer",
      ["career"]
    );

    expect(engine.count()).toBe(1);
  });

  it("searches memories", () => {
    const engine = new MemoryEngine();

    engine.add(
      MemoryType.PROJECT,
      "IAURA Project",
      ["project"]
    );

    expect(engine.search("IAURA")).toHaveLength(1);
  });

  it("filters by type", () => {
    const engine = new MemoryEngine();

    engine.add(
      MemoryType.GOAL,
      "Goal",
      []
    );

    engine.add(
      MemoryType.PROFILE,
      "Diego",
      []
    );

    expect(
      engine.getByType(MemoryType.GOAL)
    ).toHaveLength(1);
  });
});