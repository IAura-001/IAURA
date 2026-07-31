"use client";

import { useI18n } from "@/core/i18n/I18nContext";

type ProgressSummaryProps = {
  completed: number;
  total: number;
};

export default function ProgressSummary({
  completed,
  total,
}: ProgressSummaryProps) {
  const { t } = useI18n();
  const percentage =
    total > 0
      ? Math.round((completed / total) * 100)
      : 0;

  return (
    <div className="lg:col-span-2">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs tracking-[0.25em] text-zinc-500">
              {t("progress.eyebrow")}
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              {t("progress.title")}
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              {t("progress.completed", {
                completed,
                total,
              })}
            </p>
          </div>

          <p className="text-3xl font-bold text-purple-300">
            {percentage}%
          </p>
        </div>

        <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
