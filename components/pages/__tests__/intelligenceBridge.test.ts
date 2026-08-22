import { describe, expect, it, vi } from "vitest";
import { prepareIntelligenceBridgeAuthority } from "../intelligenceBridge";
import type { IAuraProject } from "@/types/project";

const project = (id: string): IAuraProject => ({
  id, name: "Same name", description: "", goal: "", status: "planning", kind: "general",
  createdAt: "2026-08-22T00:00:00Z", updatedAt: "2026-08-22T00:00:00Z",
  studios: { branding: false, website: false, app: false, marketing: false, documents: false },
});

describe("Home Intelligence to Presencia bridge authority", () => {
  it("prepares exact A to B to A authority without using display names", async () => {
    let activeId = "project-b";
    const projects = new Map([
      ["project-a", project("project-a")],
      ["project-b", project("project-b")],
    ]);
    const repository = {
      getProject: vi.fn((id: string) => projects.get(id) ?? null),
      getActiveProject: vi.fn(() => projects.get(activeId) ?? null),
      ensureActiveProjectId: vi.fn(async (id: string) => { activeId = id; return { ok: true, outcome: "committed" as const, revision: 1 }; }),
    };

    for (const projectId of ["project-a", "project-b", "project-a"]) {
      await expect(prepareIntelligenceBridgeAuthority({ prompt: "Manage", scopeType: "project", projectId }, repository)).resolves.toBe(true);
      expect(activeId).toBe(projectId);
    }
    expect(repository.ensureActiveProjectId).toHaveBeenNthCalledWith(1, "project-a");
    expect(repository.ensureActiveProjectId).toHaveBeenNthCalledWith(3, "project-a");
  });

  it("keeps global authority global and rejects an unknown project", async () => {
    const repository = {
      getProject: vi.fn(() => null), getActiveProject: vi.fn(() => null), ensureActiveProjectId: vi.fn(),
    };
    await expect(prepareIntelligenceBridgeAuthority({ prompt: "Global", scopeType: "global", projectId: null }, repository)).resolves.toBe(true);
    await expect(prepareIntelligenceBridgeAuthority({ prompt: "Missing", scopeType: "project", projectId: "missing" }, repository)).resolves.toBe(false);
    expect(repository.ensureActiveProjectId).not.toHaveBeenCalled();
  });
});
