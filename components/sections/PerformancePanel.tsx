"use client";

import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";

interface PerformancePanelProps {
  messageCount: number;
  goalsCount: number;
  habitsCount: number;
}

function formatDuration(duration: number | null) {
  if (duration === null) {
    return "Waiting";
  }

  if (duration < 1) {
    return "< 1 ms";
  }

  if (duration >= 1000) {
    return `${(duration / 1000).toFixed(2)} s`;
  }

  return `${duration.toFixed(2)} ms`;
}

export default function PerformancePanel({
  messageCount,
  goalsCount,
  habitsCount,
}: PerformancePanelProps) {
  const metrics = usePerformanceMetrics();

  const items = [
    {
      label: "AI response",
      value: formatDuration(metrics.latestResponseMs),
    },
    {
      label: "Decision Engine",
      value: formatDuration(metrics.latestDecisionMs),
    },
    {
      label: "Messages",
      value: messageCount.toString(),
    },
    {
      label: "Memory goals",
      value: goalsCount.toString(),
    },
    {
      label: "Memory habits",
      value: habitsCount.toString(),
    },
  ];

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
      <div>
        <p className="text-xs tracking-[0.25em] text-zinc-500">
          SYSTEM PERFORMANCE
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          IAURA Diagnostics
        </h2>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <p className="text-xs text-zinc-500">
              {item.label}
            </p>

            <p className="mt-2 text-lg font-medium text-zinc-100">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}