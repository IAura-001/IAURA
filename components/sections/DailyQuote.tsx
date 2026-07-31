"use client";

import {
  useEffect,
  useState,
} from "react";
import { useI18n } from "@/core/i18n/I18nContext";
import type { MessageKey } from "@/core/i18n/messages";

const quoteKeys: MessageKey[] = [
  "quote.1",
  "quote.2",
  "quote.3",
  "quote.4",
  "quote.5",
];

export default function DailyQuote() {
  const [quoteIndex, setQuoteIndex] =
    useState(0);
  const { t } = useI18n();

  useEffect(() => {
    const quoteTimer = window.setTimeout(
      () => {
        setQuoteIndex(
          Math.floor(
            Math.random() * quoteKeys.length
          )
        );
      },
      0
    );

    return () => {
      window.clearTimeout(quoteTimer);
    };
  }, []);

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
      <p className="text-xs tracking-[0.25em] text-zinc-500">
        {t("quote.eyebrow")}
      </p>

      <p className="mt-4 text-lg italic leading-8 text-zinc-200">
        &quot;{t(quoteKeys[quoteIndex])}&quot;
      </p>
    </div>
  );
}
