"use client";

import { useSyncExternalStore } from "react";

import { performanceMonitor } from "@/core/performance";

export function usePerformanceMetrics() {
  return useSyncExternalStore(
    performanceMonitor.subscribe,
    performanceMonitor.getSnapshot,
    performanceMonitor.getServerSnapshot
  );
}