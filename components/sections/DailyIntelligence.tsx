type DailyIntelligenceProps = {
  priorities: string[];
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
              key={index}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
            >
              <span className="text-cyan-300 font-bold">
                {index + 1}.
              </span>

              <p className="text-zinc-200">
                {priority}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}