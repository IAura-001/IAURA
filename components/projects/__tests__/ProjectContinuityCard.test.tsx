import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectContinuityCard from "../ProjectContinuityCard";
import { conversationRepository } from "@/core/conversation";
import { projectRepository } from "@/core/project/ProjectRepository";
import type { IAuraProject } from "@/types/project";

function project(id: string): IAuraProject {
  return {
    id, name: id, description: "", goal: "Ship", kind: "general",
    createdAt: "2026-08-14T10:00:00Z", updatedAt: "2026-08-14T10:00:00Z",
    status: "building",
    studios: { branding: false, website: false, app: false, marketing: false, documents: false },
  };
}

function seedDeferred(projectId: string): void {
  const created = conversationRepository.createConversation({ projectId }).conversation!;
  conversationRepository.updateConversationMetadata(created.conversationId, {
    betaWorkflow: {
      version: 1, status: "deferred",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "context", confirmedAt: "2026-08-14T10:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "outcome", confirmedAt: "2026-08-14T10:01:00Z" },
      confirmedNextStep: { action: "Run the same test", whyNow: "Now", result: "R", doneWhen: "D", sourceMessageId: "step", confirmedAt: "2026-08-14T10:02:00Z" },
      sessionDecision: { kind: "continue-later", sourceMessageId: "defer", decidedAt: "2026-08-14T10:03:00Z" },
    },
  });
}

describe("ProjectContinuityCard", () => {
  beforeEach(() => {
    conversationRepository.clearAllConversations();
  });

  it("uses project surface text roles without fading the continuity action", () => {
    render(<ProjectContinuityCard projectId="wellness" onOpenConversation={vi.fn()} />);
    const card = screen.getByRole("region", { name: "Continuidad del proyecto" });
    expect(card.className).toContain("--project-surface-elevated");
    expect(card.innerHTML).toContain("--project-text-secondary");
    expect(card.innerHTML).toContain("--project-metadata");
    expect(within(card).getByRole("button").className).not.toContain("disabled:opacity-50");
  });

  it("renders exactly one context action when there is no active cycle", async () => {
    const onOpenConversation = vi.fn();
    render(
      <ProjectContinuityCard
        projectId="empty-project"
        onOpenConversation={onOpenConversation}
      />,
    );
    const card = screen.getByRole("region", { name: "Continuidad del proyecto" });
    expect(within(card).getAllByRole("button")).toHaveLength(1);
    await userEvent.setup().click(
      within(card).getByRole("button", { name: "Definir contexto" }),
    );
    expect(onOpenConversation).toHaveBeenCalledOnce();
  });

  it("directly resumes a deferred project and preserves its founder-facing summary", async () => {
    const activeProject = project("deferred-project");
    projectRepository.setActiveProject(activeProject);
    seedDeferred(activeProject.id);
    render(<ProjectContinuityCard projectId={activeProject.id} onOpenConversation={vi.fn()} />);
    const card = screen.getByRole("region", { name: "Continuidad del proyecto" });
    expect(card).toHaveAttribute("data-continuity-state", "deferred");
    expect(card).toHaveTextContent("Run the same test");
    expect(within(card).getAllByRole("button")).toHaveLength(1);

    await userEvent.setup().click(
      within(card).getByRole("button", { name: "Retomar paso" }),
    );
    await waitFor(() => {
      expect(card).toHaveAttribute("data-continuity-state", "started");
    });
    expect(conversationRepository.getActiveConversation(activeProject.id)?.betaWorkflow)
      .toMatchObject({
        status: "started",
        confirmedNextStep: { action: "Run the same test" },
      });
    expect(within(card).getByRole("button", { name: "Reportar ejecución" }))
      .toBeVisible();
  });

  it("replaces continuity immediately when switching projects without leaking state", async () => {
    seedDeferred("project-a");
    const { rerender } = render(
      <ProjectContinuityCard projectId="project-a" onOpenConversation={vi.fn()} />,
    );
    const card = screen.getByRole("region", { name: "Continuidad del proyecto" });
    expect(card).toHaveTextContent("Run the same test");
    rerender(<ProjectContinuityCard projectId="project-b" onOpenConversation={vi.fn()} />);
    await waitFor(() => {
      expect(card).toHaveAttribute("data-continuity-state", "no-active-cycle");
    });
    expect(card).not.toHaveTextContent("Run the same test");
    expect(within(card).getByRole("button", { name: "Definir contexto" })).toBeVisible();
  });
});
