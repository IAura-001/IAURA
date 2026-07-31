"use client";

import { useI18n } from "@/core/i18n/I18nContext";

interface AIAnalysisPanelProps {
  analysis: string;
}

export function AIAnalysisPanel({
  analysis,
}: AIAnalysisPanelProps) {
  const { t } = useI18n();

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-4 text-xl font-bold">
        {t("analysis.title")}
      </h2>

      <p className="whitespace-pre-wrap text-zinc-300">
        {analysis}
      </p>
    </section>
  );
}
