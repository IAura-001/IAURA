interface AIAnalysisPanelProps {
  analysis: string;
}

export function AIAnalysisPanel({
  analysis,
}: AIAnalysisPanelProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-4 text-xl font-bold">
        🧠 IAURA Analysis
      </h2>

      <p className="whitespace-pre-wrap text-zinc-300">
        {analysis}
      </p>
    </section>
  );
}