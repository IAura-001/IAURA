import type { IAuraProject } from "@/types/project";

import { authenticatedIntelligenceRepository, type AuthenticatedIntelligenceRepository } from "./AuthenticatedIntelligenceRepository";
import type { IntelligenceRecord } from "./domain";
import type { IntelligenceActionProposal, IntelligenceActionReceipt } from "./actionTypes";

function receipt(
  proposal: IntelligenceActionProposal,
  sourceMessageId: string,
  status: IntelligenceActionReceipt["status"],
  summary: string,
): IntelligenceActionReceipt {
  return {
    receiptId: `intelligence-${proposal.executionId ?? crypto.randomUUID()}`,
    sourceMessageId,
    operation: proposal.operation,
    scopeType: proposal.scopeType,
    projectId: proposal.projectId,
    status,
    summary,
  };
}

function inScope(record: IntelligenceRecord, proposal: IntelligenceActionProposal): boolean {
  return record.scopeType === proposal.scopeType && record.projectId === proposal.projectId;
}

export class IntelligenceActionExecutor {
  constructor(
    private readonly repository: Pick<AuthenticatedIntelligenceRepository, "loadProjection" | "create" | "update" | "reorderPriorities"> = authenticatedIntelligenceRepository,
  ) {}

  async execute(
    proposal: IntelligenceActionProposal,
    sourceMessageId: string,
    activeProject: IAuraProject | null,
  ): Promise<IntelligenceActionReceipt> {
    if (proposal.scopeType === "global" && (proposal.projectId !== null || proposal.expectedActiveProjectId !== null))
      return receipt(proposal, sourceMessageId, "stale", "Global scope is no longer valid.");
    if (proposal.scopeType === "project" &&
      (!activeProject || activeProject.id !== proposal.projectId || proposal.expectedActiveProjectId !== activeProject.id))
      return receipt(proposal, sourceMessageId, "stale", "The active project changed. No Intelligence change was applied.");

    let records: IntelligenceRecord[];
    try {
      records = await this.repository.loadProjection(activeProject?.id ?? null);
    } catch {
      return receipt(proposal, sourceMessageId, "failed", "Canonical Intelligence could not be revalidated. No change was applied.");
    }
    const scoped = records.filter((record) => inScope(record, proposal));
    const createOperation = proposal.operation === "intelligence_create_goal" ||
      proposal.operation === "intelligence_create_priority" ||
      proposal.operation === "intelligence_create_recurring_commitment" ||
      (proposal.operation === "intelligence_set_direction" && proposal.recordId === null);
    if (createOperation && !proposal.executionId)
      return receipt(proposal, sourceMessageId, "failed", "Trusted execution identity is missing. No change was applied.");
    const existing = "recordId" in proposal && proposal.recordId
      ? scoped.find((record) => record.id === proposal.recordId)
      : undefined;
    if ("recordId" in proposal && proposal.recordId &&
      (!existing || !("expectedUpdatedAt" in proposal) || existing.updatedAt !== proposal.expectedUpdatedAt))
      return receipt(proposal, sourceMessageId, "stale", "Canonical Intelligence changed after this proposal. No change was applied.");

    try {
      if (proposal.operation === "intelligence_set_direction") {
        if (proposal.recordId) {
          if (existing?.type !== "direction" || existing.status !== "active") throw new Error("STALE");
          await this.repository.update(proposal.recordId, { content: proposal.content }, proposal.expectedUpdatedAt!, proposal);
        } else {
          await this.repository.create({ type: "direction", scopeType: proposal.scopeType, projectId: proposal.projectId, content: proposal.content }, proposal.executionId, proposal.operation, proposal.expectedActiveProjectId);
        }
      } else if (proposal.operation === "intelligence_create_goal") {
        await this.repository.create({ type: "goal", scopeType: proposal.scopeType, projectId: proposal.projectId, title: proposal.title, targetDate: null }, proposal.executionId, proposal.operation, proposal.expectedActiveProjectId);
      } else if (proposal.operation === "intelligence_set_goal_status") {
        if (existing?.type !== "goal" || existing.status === "archived") throw new Error("STALE");
        await this.repository.update(proposal.recordId, { status: proposal.status }, proposal.expectedUpdatedAt, proposal);
      } else if (proposal.operation === "intelligence_create_priority") {
        await this.repository.create({ type: "priority", scopeType: proposal.scopeType, projectId: proposal.projectId, title: proposal.title, goalId: proposal.goalId }, proposal.executionId, proposal.operation, proposal.expectedActiveProjectId);
      } else if (proposal.operation === "intelligence_reorder_priorities") {
        const current = scoped.filter((record): record is Extract<IntelligenceRecord, { type: "priority" }> => record.type === "priority" && record.status === "active").sort((a, b) => a.position - b.position);
        const expected = proposal.expectedPriorities.slice().sort((a, b) => a.position - b.position);
        if (current.length !== expected.length || current.some((row, index) => row.id !== expected[index]?.recordId || row.position !== expected[index]?.position || row.updatedAt !== expected[index]?.updatedAt) ||
          proposal.orderedPriorityIds.length !== current.length || proposal.orderedPriorityIds.some((id) => !current.some((row) => row.id === id))) throw new Error("STALE");
        await this.repository.reorderPriorities(proposal.scopeType, proposal.projectId, proposal.orderedPriorityIds,
          expected.map(({ recordId, position, updatedAt }) => ({ recordId, position, updatedAt })), proposal.expectedActiveProjectId);
      } else if (proposal.operation === "intelligence_archive_priority") {
        if (existing?.type !== "priority" || existing.status !== "active") throw new Error("STALE");
        await this.repository.update(proposal.recordId, { status: "archived" }, proposal.expectedUpdatedAt, proposal);
      } else if (proposal.operation === "intelligence_create_recurring_commitment") {
        await this.repository.create({ type: "recurring_commitment", scopeType: proposal.scopeType, projectId: proposal.projectId, title: proposal.title, cadence: proposal.cadence, cadenceDetail: proposal.cadenceDetail }, proposal.executionId, proposal.operation, proposal.expectedActiveProjectId);
      } else {
        if (existing?.type !== "recurring_commitment" || existing.status === "archived") throw new Error("STALE");
        await this.repository.update(proposal.recordId, { status: proposal.status }, proposal.expectedUpdatedAt, proposal);
      }
      try {
        await this.repository.loadProjection(activeProject?.id ?? null);
      } catch (error) {
        console.warn(
          "Intelligence mutation succeeded, but canonical context refresh failed.",
          error instanceof Error ? error.message : error,
        );
      }
      return receipt(proposal, sourceMessageId, "executed", `Verified Intelligence change: ${proposal.proposedSummary}`);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      return receipt(
        proposal,
        sourceMessageId,
        code === "STALE" || code === "IAURA_INTELLIGENCE_STALE" ? "stale" : "failed",
        code === "LIMIT" || code === "IAURA_INTELLIGENCE_PRIORITY_LIMIT"
          ? "The scope already has three active priorities. No change was applied."
          : code === "STALE" || code === "IAURA_INTELLIGENCE_STALE"
            ? "Canonical Intelligence changed after this proposal. No change was applied."
            : "The authenticated persistence outcome could not be verified. Refresh canonical Intelligence before attempting another change.",
      );
    }
  }
}

export const intelligenceActionExecutor = new IntelligenceActionExecutor();
