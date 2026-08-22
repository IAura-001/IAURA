import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import IntelligenceActionCard from "../IntelligenceActionCard";

const proposal = {
  operation: "intelligence_set_goal_status" as const,
  scopeType: "project" as const,
  projectId: "project-a",
  expectedActiveProjectId: "project-a",
  projectName: "VAEORA",
  recordId: "private-record-id",
  expectedUpdatedAt: "2026-08-21T00:00:00Z",
  status: "completed" as const,
  currentSummary: "Active: Finish Intelligence v2",
  proposedSummary: "Completed: Finish Intelligence v2",
};

describe("IntelligenceActionCard", () => {
  it("keeps the existing create-priority card contract unchanged", () => {
    const createPriority = {
      operation: "intelligence_create_priority" as const,
      scopeType: "global" as const,
      projectId: null,
      expectedActiveProjectId: null,
      projectName: null,
      title: "Finish Intelligence v2",
      goalId: null,
      currentSummary: "No matching priority",
      proposedSummary: "Create priority: Finish Intelligence v2",
    };
    const choice = {
      label: "Confirm",
      description: "Create",
      prompt: "Confirm",
      confirmation: { kind: "intelligence-action" as const, decision: "confirm" as const, proposal: createPriority },
    };

    render(<IntelligenceActionCard choices={[choice]} sourceMessageId="create-priority" onChoose={vi.fn()} />);
    expect(screen.getByText("CREATE PRIORITY")).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.getByText(createPriority.proposedSummary)).toBeInTheDocument();
  });

  it("renders a persisted global reorder with deterministic labels and no UUIDs", async () => {
    const firstId = "00000000-0000-4000-8000-000000000001";
    const secondId = "00000000-0000-4000-8000-000000000002";
    const reorder = {
      operation: "intelligence_reorder_priorities" as const,
      executionId: "70000000-0000-4000-8000-000000000001",
      scopeType: "global" as const, projectId: null, expectedActiveProjectId: null, projectName: null,
      currentSummary: "Current priorities", proposedSummary: "Proposed priorities",
      orderedPriorityIds: [secondId, firstId],
      expectedPriorities: [
        { recordId: firstId, position: 1, updatedAt: "2026-08-21T00:00:00Z", label: "Finish Intelligence v2" },
        { recordId: secondId, position: 2, updatedAt: "2026-08-21T00:00:01Z", label: "Train consistently" },
      ],
    };
    const onChoose = vi.fn().mockResolvedValue(undefined);
    const choices = ["confirm", "cancel"].map((decision) => ({
      label: decision === "confirm" ? "Confirm" : "Cancel", description: decision, prompt: decision,
      confirmation: { kind: "intelligence-action" as const, decision: decision as "confirm" | "cancel", proposal: reorder },
    }));
    render(<IntelligenceActionCard choices={choices} sourceMessageId="reorder-source" onChoose={onChoose} />);

    expect(screen.getByText("REORDER PRIORITIES")).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.getByText("Current").parentElement).toHaveTextContent(/1\. Finish Intelligence v2\s+2\. Train consistently/);
    expect(screen.getByText("Proposed").parentElement).toHaveTextContent(/1\. Train consistently\s+2\. Finish Intelligence v2/);
    expect(screen.queryByText(firstId)).not.toBeInTheDocument();
    expect(screen.queryByText(secondId)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onChoose).toHaveBeenCalledWith(choices[0], "reorder-source"));
  });

  it("keeps a resolved project reorder scoped and non-actionable", () => {
    const firstId = "00000000-0000-4000-8000-000000000001";
    const reorder = {
      operation: "intelligence_reorder_priorities" as const,
      scopeType: "project" as const, projectId: "project-a", expectedActiveProjectId: "project-a", projectName: "VAEORA",
      currentSummary: "Current", proposedSummary: "Proposed", orderedPriorityIds: [firstId],
      expectedPriorities: [{ recordId: firstId, position: 1, updatedAt: "2026-08-21T00:00:00Z", label: "Ship" }],
    };
    const choice = { label: "Cancel", description: "Keep", prompt: "Cancel", confirmation: { kind: "intelligence-action" as const, decision: "cancel" as const, proposal: reorder } };
    const onChoose = vi.fn();
    render(<IntelligenceActionCard choices={[choice]} sourceMessageId="source" resolved onChoose={onChoose} />);
    expect(screen.getByText(/Project .* VAEORA/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("shows deterministic scope/current/proposed data without raw IDs and disables duplicate confirmation", async () => {
    let release!: () => void;
    const onChoose = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const choices = ["confirm", "cancel"].map((decision) => ({
      label: decision === "confirm" ? "Confirm" : "Cancel",
      description: decision,
      prompt: decision,
      confirmation: { kind: "intelligence-action" as const, decision: decision as "confirm" | "cancel", proposal },
    }));
    render(<IntelligenceActionCard choices={choices} sourceMessageId="source-a" onChoose={onChoose} />);

    expect(screen.getByText("Project — VAEORA")).toBeInTheDocument();
    expect(screen.getByText(proposal.currentSummary)).toBeInTheDocument();
    expect(screen.getByText(proposal.proposedSummary)).toBeInTheDocument();
    expect(screen.queryByText("private-record-id")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(true);
    release();
    await waitFor(() => expect(onChoose).toHaveBeenCalledTimes(1));
  });

  it("keeps the choices retryable and announces a rejected confirmation", async () => {
    const onChoose = vi.fn().mockRejectedValue(new Error("persistence unavailable"));
    const choices = ["confirm", "cancel"].map((decision) => ({
      label: decision === "confirm" ? "Confirm" : "Cancel",
      description: decision,
      prompt: decision,
      confirmation: { kind: "intelligence-action" as const, decision: decision as "confirm" | "cancel", proposal },
    }));
    render(<IntelligenceActionCard choices={choices} sourceMessageId="source-a" onChoose={onChoose} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("persistence unavailable");
    expect(screen.getByRole("button", { name: "Confirm" })).not.toBeDisabled();
  });

  it("prevents a hydrated resolved proposal from becoming actionable again", () => {
    const onChoose = vi.fn();
    const choices = [{
      label: "Confirm", description: "confirm", prompt: "confirm",
      confirmation: { kind: "intelligence-action" as const, decision: "confirm" as const, proposal },
    }];
    render(<IntelligenceActionCard choices={choices} sourceMessageId="source-a" resolved onChoose={onChoose} />);

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toBeDisabled();
    expect(onChoose).not.toHaveBeenCalled();
  });
});
