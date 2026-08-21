import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationController } from "@/core/conversation/ConversationController";
import { LocalConversationRepository } from "@/core/conversation/ConversationRepository";
import { AuthenticatedProjectRepository } from "../AuthenticatedProjectRepository";
import { ProjectEngine } from "../ProjectEngine";
import { useAuthenticatedActiveProject } from "../useAuthenticatedActiveProject";
import type { IAuraProject } from "../types";

function project(id: string, name: string): IAuraProject {
  return {
    id, name, description: "", goal: `${name} goal`, kind: "general",
    status: "planning", createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
    studios: { branding: false, website: false, app: false, marketing: false, documents: false },
  };
}

describe("authenticated project flow", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("propagates A to B to A through repository, HomePage hook, conversation lookup and controller context", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const projectA = project("project-a", "Project A");
    const projectB = project("project-b", "Project B");
    const projects = new AuthenticatedProjectRepository();
    projects.configure("user-a", [projectA, projectB], projectA.id);
    const engine = new ProjectEngine(projects);
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const analyze = vi.fn((input) => ({ input }));
    const controller = new ConversationController({
      projects,
      conversations,
      brain: { analyze } as never,
      generateResponse: vi.fn().mockResolvedValue({
        content: "Acknowledged.", actions: [], memoryUpdates: [],
        experience: { kind: "general", title: "", summary: "", phases: [], choices: [], recommendedSurface: "none" },
      }),
      contextRetriever: { retrieve: vi.fn().mockResolvedValue({
        query: "", items: [], totalCandidates: 0, truncated: false,
        generatedAt: new Date("2026-08-20T10:00:00.000Z"),
      }) },
    });
    const { result } = renderHook(() => useAuthenticatedActiveProject(projects));

    expect(result.current?.id).toBe(projectA.id);
    act(() => engine.setCurrentProject(projectB));
    await projects.flush();
    expect(projects.getActiveProject()?.id).toBe(projectB.id);
    expect(result.current?.id).toBe(projectB.id);
    await controller.send("Work on B", "Context B");
    expect(conversations.getActiveConversation(projectB.id)?.projectId).toBe(projectB.id);
    expect(analyze).toHaveBeenLastCalledWith(expect.objectContaining({
      conversationIdentity: expect.objectContaining({ projectId: projectB.id }),
    }));
    expect(fetchMock).toHaveBeenCalledWith("/api/project-state", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ activeProjectId: projectB.id }),
    }));

    act(() => engine.setCurrentProject(projectA));
    await projects.flush();
    expect(result.current?.id).toBe(projectA.id);
    await controller.send("Return to A", "Context A");
    expect(conversations.getActiveConversation(projectA.id)?.projectId).toBe(projectA.id);
    expect(analyze).toHaveBeenLastCalledWith(expect.objectContaining({
      conversationIdentity: expect.objectContaining({ projectId: projectA.id }),
    }));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/project-state", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ activeProjectId: projectA.id }),
    }));
  });
});
