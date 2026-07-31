"use client";

import { useState } from "react";
import {
  LANGUAGE_DEFINITIONS,
  type SupportedLocale,
} from "@/core/i18n/languages";
import { useI18n } from "@/core/i18n/I18nContext";

type ProfileSettingsProps = {
  userName: string;
  preferredLocale: SupportedLocale;
  onSaveName: (name: string) => void;
  onLanguageChange: (
    locale: SupportedLocale
  ) => void;
};

export default function ProfileSettings({
  userName,
  preferredLocale,
  onSaveName,
  onLanguageChange,
}: ProfileSettingsProps) {
  const [name, setName] = useState(userName);
  const { t } = useI18n();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) return;

    onSaveName(cleanName);
  }

  return (
    <div className="lg:col-span-2">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <p className="text-xs tracking-[0.25em] text-zinc-500">
          {t("profile.eyebrow")}
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          {t("profile.title")}
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          {t("profile.description")}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 grid gap-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder={t(
                "profile.namePlaceholder"
              )}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400/50"
            />

            <button
              type="submit"
              className="rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500"
            >
              {t("profile.save")}
            </button>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-zinc-200">
              {t("profile.languageLabel")}
            </span>

            <select
              value={preferredLocale}
              onChange={(event) =>
                onLanguageChange(
                  event.target
                    .value as SupportedLocale
                )
              }
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-purple-400/50"
            >
              {LANGUAGE_DEFINITIONS.map(
                (language) => (
                  <option
                    key={language.locale}
                    value={language.locale}
                    className="bg-zinc-950"
                  >
                    {language.nativeName}
                  </option>
                )
              )}
            </select>

            <span className="text-xs text-zinc-500">
              {t("profile.languageHint")}
            </span>
          </label>
        </form>
      </div>
    </div>
  );
}
