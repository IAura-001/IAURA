"use client";

import { useI18n } from "@/core/i18n/I18nContext";
import { BrandMark } from "@/components/branding/BrandMark";
import type {
  BrandLogoSystem,
  BrandPalette,
} from "@/types/project";

interface BrandIdentityCardProps {
  name: string;
  slogan: string;
  mission: string;
  colors: string[];
  logo: BrandLogoSystem;
  palette: BrandPalette;
  font: string;
  onContinue: () => void;
}

export function BrandIdentityCard({
  name,
  slogan,
  mission,
  colors,
  logo,
  palette,
  font,
  onContinue,
}: BrandIdentityCardProps) {
  const { t } = useI18n();

  return (
    <article
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.32)] backdrop-blur-xl"
      style={{
        backgroundImage: `radial-gradient(circle at 100% 0%, ${colors[2]}24, transparent 38%)`,
      }}
    >
      <div className="relative space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <BrandMark
              brandName={name}
              logo={logo}
              palette={palette}
              size={52}
              label={`${name} ${t("branding.logoTitle")}`}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-purple-300/70">
                {t("branding.eyebrow")}
              </p>
              <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-white">
                {name}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">{slogan}</p>
            </div>
          </div>

          <div className="flex -space-x-2" aria-label={t("brand.identityColorsLabel")}>
            {colors.map((color) => (
              <span
                key={color}
                className="h-9 w-9 rounded-full border-2 border-[#0b0712] shadow-lg"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-600">
              {t("brand.identityMissionLabel")}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              {mission}
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-zinc-300">
            {font}
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="group flex w-full items-center justify-between rounded-2xl border border-purple-400/20 bg-gradient-to-r from-purple-600/80 to-blue-600/80 px-5 py-3.5 text-sm font-semibold text-white transition hover:border-purple-300/40 hover:brightness-110"
        >
          <span>{t("brand.identityContinue")}</span>
          <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </article>
  );
}
