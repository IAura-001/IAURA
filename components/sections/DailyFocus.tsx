"use client";

import { useI18n } from "@/core/i18n/I18nContext";

export default function DailyFocus() {
  const { t } = useI18n();
  const focusItems = [
    t("focus.item1"),
    t("focus.item2"),
    t("focus.item3"),
  ];

  return (
    <div className="lg:col-span-2">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <p className="text-xs tracking-[0.25em] text-zinc-500">
          {t("focus.eyebrow")}
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          {t("focus.title")}
        </h2>

        <div className="mt-6 grid gap-3">
          {focusItems.map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            >
              <span className="text-purple-300">
                ✦
              </span>

              <p className="text-sm text-zinc-300">
                {item}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
