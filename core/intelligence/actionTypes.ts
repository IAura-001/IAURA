import type { IntelligenceScopeType } from "./domain";

export interface ProposalBase {
  executionId?: string;
  scopeType: IntelligenceScopeType;
  projectId: string | null;
  expectedActiveProjectId: string | null;
  projectName: string | null;
  currentSummary: string;
  proposedSummary: string;
}

interface ExistingRecordProposal extends ProposalBase {
  recordId: string;
  expectedUpdatedAt: string;
}

export interface ExpectedPrioritySnapshot {
  recordId: string;
  position: number;
  updatedAt: string;
  label: string;
}

export type IntelligenceActionProposal =
  | (ProposalBase & { operation: "intelligence_set_direction"; recordId: string | null; expectedUpdatedAt: string | null; content: string })
  | (ProposalBase & { operation: "intelligence_create_goal"; title: string })
  | (ExistingRecordProposal & { operation: "intelligence_set_goal_status"; status: "completed" | "archived" })
  | (ProposalBase & { operation: "intelligence_create_priority"; title: string | null; goalId: string | null })
  | (ProposalBase & { operation: "intelligence_reorder_priorities"; orderedPriorityIds: string[]; expectedPriorities: ExpectedPrioritySnapshot[] })
  | (ExistingRecordProposal & { operation: "intelligence_archive_priority" })
  | (ProposalBase & { operation: "intelligence_create_recurring_commitment"; title: string; cadence: "daily" | "weekly" | "custom"; cadenceDetail: string | null })
  | (ExistingRecordProposal & { operation: "intelligence_set_recurring_commitment_status"; status: "active" | "paused" | "archived" });

export interface IntelligenceActionConfirmation {
  kind: "intelligence-action";
  decision: "confirm" | "cancel";
  proposal: IntelligenceActionProposal;
}

export type IntelligenceActionReceiptStatus = "executed" | "cancelled" | "failed" | "stale";

export interface IntelligenceActionReceipt {
  receiptId: string;
  sourceMessageId: string;
  operation: IntelligenceActionProposal["operation"];
  scopeType: IntelligenceScopeType;
  projectId: string | null;
  status: IntelligenceActionReceiptStatus;
  summary: string;
}
