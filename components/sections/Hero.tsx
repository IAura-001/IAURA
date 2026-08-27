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
      <p className="mb-3 font-mono text-[10px] font-medium tracking-[0.26em] text-[var(--project-metadata,#a78bfa)]">
        {t("hero.eyebrow")}
      </p>

      <h2 className="text-3xl font-medium leading-[1.08] tracking-[-0.035em] text-[var(--project-text,#fff)] sm:text-4xl">
        {name ? t("hero.greeting", { name }) : "Hola."}

        <span className="mt-2 block text-[var(--project-link,#c4b5fd)]">
          {t("hero.identity")}
        </span>
      </h2>

      <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--project-text-secondary,#a1a1aa)] sm:text-[15px]">
        {t("hero.intro")}
      </p>
    </div>
  );
}
