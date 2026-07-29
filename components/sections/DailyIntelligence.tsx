type PriorityItem = {
  title: string;
  score: number;
};

type DailyIntelligenceProps = {
  priorities: PriorityItem[];
};

export default function DailyIntelligence({
  priorities,
}: DailyIntelligenceProps) {
  return (
    <div className="lg:col-span-2">
      <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 p-6 backdrop-blur-xl">
        <p className="text-xs tracking-[0.25em] text-cyan-300">
          IAURA INTELLIGENCE
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          Today's Priorities
        </h2>

        <p className="mt-2 text-sm text-zinc-300">
          Based on your goals and habits, these deserve your attention today.
        </p>

        <div className="mt-6 space-y-3">
          {priorities.map((priority, index) => (
  <div
    key={`${priority.title}-${index}`}
    className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
  >
    <div className="flex items-center gap-3">
      <span className="font-bold text-cyan-300">
        {index + 1}.
      </span>

      <p className="text-zinc-200">
        {priority.title}
      </p>
    </div>

    <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
      {priority.score} pts
    </span>
  </div>
))}
        </div>
      </div>
    </div>
  );
}