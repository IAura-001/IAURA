export interface PerformanceSnapshot {
  latestResponseMs: number | null;
  latestDecisionMs: number | null;
  responseSamples: number;
  decisionSamples: number;
}
