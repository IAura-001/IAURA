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
      <p className="mb-3 font-mono text-[10px] font-medium tracking-[0.26em] text-violet-300/65">
        {t("hero.eyebrow")}
      </p>

      <h2 className="text-3xl font-medium leading-[1.08] tracking-[-0.035em] text-white sm:text-4xl">
        {t("hero.greeting", { name })}

        <span className="mt-2 block bg-gradient-to-r from-violet-300 via-violet-200 to-indigo-300 bg-clip-text text-transparent">
          {t("hero.identity")}
        </span>
      </h2>

      <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400 sm:text-[15px]">
        {t("hero.intro")}
      </p>
    </div>
  );
}
