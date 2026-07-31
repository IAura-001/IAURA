export type AutonomyMode = "supervised";

export type AutonomyDefaultAction = "proceed";

export type HumanDecisionGate =
  | "personal_preference"
  | "missing_authority"
  | "credentials_or_identity"
  | "financial_commitment"
  | "external_commitment"
  | "irreversible_action"
  | "high_stakes";

export interface AutonomyAssessment {
  mode: AutonomyMode;
  defaultAction: AutonomyDefaultAction;
  potentialHumanGates: HumanDecisionGate[];
  reason: string;
}
