"use client";

import { useEffect, useState } from "react";

const quotes = [
  "Small progress every day leads to extraordinary results.",
  "Discipline beats motivation.",
  "Execution creates momentum.",
  "Consistency compounds success.",
  "Build today what your future self will thank you for.",
];

export default function DailyQuote() {
  const [quote, setQuote] = useState(quotes[0]);

  useEffect(() => {
    const quoteTimer = window.setTimeout(() => {
      const randomIndex = Math.floor(
        Math.random() * quotes.length
      );

      setQuote(quotes[randomIndex]);
    }, 0);

    return () => {
      window.clearTimeout(quoteTimer);
    };
  }, []);

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
      <p className="text-xs tracking-[0.25em] text-zinc-500">
        DAILY QUOTE
      </p>

      <p className="mt-4 text-lg italic leading-8 text-zinc-200">
        &quot;{quote}&quot;
      </p>
    </div>
  );
}