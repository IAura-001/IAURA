const quotes = [
  "Small progress every day leads to extraordinary results.",
  "Discipline beats motivation.",
  "Execution creates momentum.",
  "Consistency compounds success.",
  "Build today what your future self will thank you for.",
];

export default function DailyQuote() {
  const quote =
    quotes[Math.floor(Math.random() * quotes.length)];

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
      <p className="text-xs tracking-[0.25em] text-zinc-500">
        DAILY QUOTE
      </p>

      <p className="mt-4 text-lg leading-8 text-zinc-200 italic">
        "{quote}"
      </p>
    </div>
  );
}