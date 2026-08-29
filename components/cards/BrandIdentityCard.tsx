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
      data-nested-surface="dark"
      className="relative overflow-hidden rounded-[22px] border border-[var(--iaura-rich-dark-border)] bg-[var(--iaura-rich-dark-surface)] p-6 text-[var(--iaura-rich-dark-text)] shadow-[0_16px_42px_rgba(0,0,0,0.18)]"
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
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-[rgb(var(--iaura-accent-rgb,216,180,254))]">
                {t("branding.eyebrow")}
              </p>
              <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-[var(--iaura-rich-dark-text)]">
                {name}
              </h2>
              <p className="mt-1 text-sm text-[var(--iaura-rich-dark-secondary)]">{slogan}</p>
            </div>
          </div>

          <div className="flex -space-x-2" aria-label={t("brand.identityColorsLabel")}>
            {colors.map((color) => (
              <span
                key={color}
                className="h-9 w-9 rounded-full border-2 border-[var(--iaura-rich-dark-surface)] shadow-sm"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[var(--iaura-rich-dark-muted)]">
              {t("brand.identityMissionLabel")}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--iaura-rich-dark-secondary)]">
              {mission}
            </p>
          </div>

          <div className="rounded-full bg-[var(--iaura-rich-dark-elevated)] px-3 py-1.5 text-xs text-[var(--iaura-rich-dark-secondary)]">
            {font}
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="group flex w-full items-center justify-between rounded-2xl border border-[var(--iaura-rich-dark-border)] bg-[var(--iaura-rich-action)] px-5 py-3.5 text-sm font-semibold text-[var(--iaura-rich-action-text)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus,var(--vaeora-focus))]"
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
