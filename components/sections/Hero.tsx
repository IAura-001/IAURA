"use client";

import { useI18n } from "@/core/i18n/I18nContext";

export default function Hero({
  name,
}: {
  name: string;
}) {
  const { t } = useI18n();

  return (
    <div>
      <p className="mb-5 text-xs font-semibold tracking-[0.3em] text-purple-400">
        {t("hero.eyebrow")}
      </p>

      <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
        {t("hero.greeting", { name })}

        <span className="mt-3 block bg-gradient-to-r from-purple-400 via-violet-300 to-blue-400 bg-clip-text text-transparent">
          {t("hero.identity")}
        </span>
      </h1>

      <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-400">
        {t("hero.intro")}
      </p>
    </div>
  );
}
