import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedProjectRepository } from "../AuthenticatedProjectRepository";
import type { IAuraProject } from "../types";

const project = (id: string, name: string): IAuraProject => ({ id, name, description: "", goal: "", createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-16T00:00:00.000Z", status: "planning", kind: "general", studios: { branding: false, website: false, app: false, marketing: false, documents: false } });

describe("AuthenticatedProjectRepository ownership scoping", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 })); });

  it("replaces all visible state when the authenticated account changes", () => {
    const repository = new AuthenticatedProjectRepository();
    repository.configure("user-a", [project("a", "A")]);
    expect(repository.getProjects().map((item) => item.name)).toEqual(["A"]);
    repository.configure("user-b", [project("b", "B")]);
    expect(repository.getProjects().map((item) => item.name)).toEqual(["B"]);
    expect(repository.getProject("a")).toBeNull();
  });

  it("restores the same user's server snapshot in a separate context", () => {
    const contextOne = new AuthenticatedProjectRepository();
    const contextTwo = new AuthenticatedProjectRepository();
    const remote = [project("same", "Remote")];
    contextOne.configure("user-a", remote);
    contextTwo.configure("user-a", remote);
    expect(contextTwo.getProjects()).toEqual(contextOne.getProjects());
  });

  it("persists mutations without sending an owner UUID", async () => {
    const repository = new AuthenticatedProjectRepository();
    repository.configure("user-a", []);
    repository.createProject(project("new", "New"));
    await repository.flush();
    expect(fetch).toHaveBeenCalledWith("/api/projects", expect.objectContaining({ method: "POST", body: expect.not.stringContaining("user-a") }));
  });

  it("can safely retry the same project persistence after an interrupted onboarding write", async () => {
    const repository = new AuthenticatedProjectRepository();
    const launch = project("launch", "Launch");
    repository.configure("user-a", [launch]);
    repository.retryProjectPersistence(launch);
    await repository.flush();
    expect(vi.mocked(fetch).mock.calls.filter(([url, init]) =>
      url === "/api/projects" && init?.method === "POST")).toHaveLength(1);
  });

  it("hydrates and selects an unchanged project without issuing a PUT", async () => {
    const repository = new AuthenticatedProjectRepository();
    const initial = project("existing", "Existing");
    repository.configure("user-a", [initial]);
    repository.setActiveProject(initial);
    repository.setActiveProject(initial);
    await repository.flush();

    const projectWrites = vi.mocked(fetch).mock.calls.filter(
      ([url]) => url === "/api/projects/existing",
    );

    expect(projectWrites).toHaveLength(0);
  });

  it("reasserts the exact active project in project_state before a scoped bridge", async () => {
    const repository = new AuthenticatedProjectRepository();
    const projectA = project("project-a", "Same display name");
    const projectB = project("project-b", "Same display name");
    repository.configure("user-a", [projectA, projectB], projectA.id);

    await expect(repository.ensureActiveProjectId(projectA.id)).resolves.toMatchObject({ ok: true });
    await expect(repository.ensureActiveProjectId(projectB.id)).resolves.toMatchObject({ ok: true });
    await expect(repository.ensureActiveProjectId(projectA.id)).resolves.toMatchObject({ ok: true });

    const stateWrites = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/project-state");
    expect(stateWrites.map(([, init]) => JSON.parse(String(init?.body)).activeProjectId)).toEqual([
      "project-a", "project-b", "project-a",
    ]);
    expect(repository.getActiveProject()?.id).toBe("project-a");
  });

  it("issues one PUT for one real mutation and does not recurse", async () => {
    const repository = new AuthenticatedProjectRepository();
    const initial = project("existing", "Existing");
    repository.configure("user-a", [initial]);
    repository.updateProject({ ...initial, name: "Changed", updatedAt: "2026-08-16T00:01:00.000Z" });
    await repository.flush();

    const projectWrites = vi.mocked(fetch).mock.calls.filter(
      ([url]) => url === "/api/projects/existing",
    );

    expect(projectWrites).toHaveLength(1);
    expect(projectWrites[0]).toEqual([
      "/api/projects/existing",
      expect.objectContaining({ method: "PUT" }),
    ]);

    await Promise.resolve();

    const projectWritesAfterMicrotask =
      vi.mocked(fetch).mock.calls.filter(
        ([url]) => url === "/api/projects/existing",
      );

    expect(projectWritesAfterMicrotask).toHaveLength(1);
  });
});
