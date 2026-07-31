"use client";

import { useI18n } from "@/core/i18n/I18nContext";

type DashboardGreetingProps = {
  name: string;
};

export default function DashboardGreeting({
  name,
}: DashboardGreetingProps) {
  const { t } = useI18n();
  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? t("dashboard.morning")
      : hour < 18
        ? t("dashboard.afternoon")
        : t("dashboard.evening");

  return (
    <div className="lg:col-span-2">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <p className="text-xs tracking-[0.25em] text-zinc-500">
          {t("dashboard.eyebrow")}
        </p>

        <h2 className="mt-3 text-3xl font-semibold text-white">
          {greeting}, {name}.
        </h2>

        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {t("dashboard.subtitle")}
        </p>
      </div>
    </div>
  );
}
