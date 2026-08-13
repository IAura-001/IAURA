import { beforeEach, describe, expect, it } from "vitest";

import type { PlannedMemoryUpdate } from "@/core/actions";
import { LocalMemoryRepository, memoryRepository } from "../MemoryRepository";
import { executeMemoryUpdates } from "../MemoryIntelligence";
import { retrieveRelevantMemories } from "../MemoryRetriever";
import { MemoryType } from "../MemoryTypes";

function projectDecision(
  content: string,
  tags: string[] = [],
): PlannedMemoryUpdate {
  return {
    operation: "remember",
    type: "project",
    content,
    tags,
    reason: "The user explicitly confirmed this project decision.",
    confidence: 0.99,
  };
}

describe("project-scoped decision memory", () => {
  beforeEach(() => {
    memoryRepository.clearMemory();
  });

  it("replaces model scope tags with exactly one trusted project scope", () => {
    const result = executeMemoryUpdates(
      [
        projectDecision("Use founders as the beta audience", [
          "audience",
          "project:nova",
          "PROJECT:hostile",
          "project:iaura",
        ]),
      ],
      "iaura",
    );

    expect(result.remembered).toHaveLength(1);
    expect(result.remembered[0].tags).toEqual([
      "audience",
      "project:iaura",
    ]);
  });

  it("does not create project memory without a trusted project id", () => {
    const result = executeMemoryUpdates([
      projectDecision("Use founders as the beta audience"),
    ]);

    expect(result.remembered).toEqual([]);
    expect(result.items[0]).toMatchObject({ status: "skipped" });
    expect(memoryRepository.getEntries()).toEqual([]);
  });

  it("deduplicates within a project but allows the same decision in another project", () => {
    const update = projectDecision("Ship the smallest validated beta");

    expect(executeMemoryUpdates([update], "iaura").remembered).toHaveLength(1);
    expect(executeMemoryUpdates([update], "iaura").remembered).toHaveLength(0);
    expect(executeMemoryUpdates([update], "nova").remembered).toHaveLength(1);
  });

  it("retrieves global memory and only the current project's decisions", () => {
    executeMemoryUpdates(
      [
        projectDecision("IAURA audience is founders", ["audience"]),
      ],
      "iaura",
    );
    executeMemoryUpdates(
      [
        projectDecision("Nova audience is researchers", ["audience"]),
      ],
      "nova",
    );
    executeMemoryUpdates([
      {
        ...projectDecision("The user prefers concise audience summaries"),
        type: "preference",
      },
    ]);

    const iaura = retrieveRelevantMemories("audience", "iaura");
    const nova = retrieveRelevantMemories("audience", "nova");

    expect(iaura.map((entry) => entry.content)).toEqual(
      expect.arrayContaining([
        "IAURA audience is founders",
        "The user prefers concise audience summaries",
      ]),
    );
    expect(iaura.map((entry) => entry.content)).not.toContain(
      "Nova audience is researchers",
    );
    expect(nova.map((entry) => entry.content)).toEqual(
      expect.arrayContaining([
        "Nova audience is researchers",
        "The user prefers concise audience summaries",
      ]),
    );
    expect(nova.map((entry) => entry.content)).not.toContain(
      "IAURA audience is founders",
    );
  });

  it("filters other projects and legacy unscoped project memory before result limits", () => {
    for (let index = 0; index < 8; index += 1) {
      executeMemoryUpdates(
        [projectDecision(`Audience decision from Nova ${index}`)],
        "nova",
      );
    }
    memoryRepository.upsertEntry({
      id: "legacy-project-memory",
      type: MemoryType.PROJECT,
      content: "Legacy audience decision",
      tags: ["audience"],
      importance: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    executeMemoryUpdates(
      [projectDecision("Audience decision from IAURA")],
      "iaura",
    );

    const results = retrieveRelevantMemories("audience", "iaura");

    expect(results.map((entry) => entry.content)).toContain(
      "Audience decision from IAURA",
    );
    expect(results.map((entry) => entry.content)).not.toContain(
      "Legacy audience decision",
    );
    expect(results.every((entry) => !entry.content.includes("Nova"))).toBe(true);
  });

  it("preserves the trusted scope through repository reconstruction", () => {
    executeMemoryUpdates(
      [projectDecision("Use founders as the beta audience")],
      "iaura",
    );

    const reconstructed = new LocalMemoryRepository();
    const restored = reconstructed
      .getEntries()
      .find((entry) => entry.content === "Use founders as the beta audience");

    expect(restored?.tags).toContain("project:iaura");
  });
});
