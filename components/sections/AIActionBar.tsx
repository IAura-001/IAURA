"use client";

import { useI18n } from "@/core/i18n/I18nContext";

interface AIActionBarProps {
  onAnalyze: () => void;
  isLoading: boolean;
}

export function AIActionBar({
  onAnalyze,
  isLoading,
}: AIActionBarProps) {
  const { t } = useI18n();

  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onAnalyze}
        disabled={isLoading}
        className="rounded-xl bg-purple-600 px-4 py-2 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading
          ? t("analysis.loading")
          : t("analysis.start")}
      </button>
    </div>
  );
}
