import type { PerformanceSnapshot } from "./types";

const INITIAL_SNAPSHOT: PerformanceSnapshot = {
  latestResponseMs: null,
  latestDecisionMs: null,
  responseSamples: 0,
  decisionSamples: 0,
};

type PerformanceListener = () => void;

class PerformanceMonitor {
  private snapshot: PerformanceSnapshot =
    INITIAL_SNAPSHOT;

  private listeners = new Set<PerformanceListener>();

  getSnapshot = (): PerformanceSnapshot => {
    return this.snapshot;
  };

  getServerSnapshot = (): PerformanceSnapshot => {
    return INITIAL_SNAPSHOT;
  };

  subscribe = (
    listener: PerformanceListener
  ): (() => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  recordResponse(durationMs: number) {
    this.snapshot = {
      ...this.snapshot,
      latestResponseMs: durationMs,
      responseSamples:
        this.snapshot.responseSamples + 1,
    };

    this.emit();
  }

  recordDecision(durationMs: number) {
    this.snapshot = {
      ...this.snapshot,
      latestDecisionMs: durationMs,
      decisionSamples:
        this.snapshot.decisionSamples + 1,
    };

    this.emit();
  }

  reset() {
    this.snapshot = INITIAL_SNAPSHOT;
    this.emit();
  }

  private emit() {
    this.listeners.forEach((listener) => {
      listener();
    });
  }
}

export const performanceMonitor =
  new PerformanceMonitor();