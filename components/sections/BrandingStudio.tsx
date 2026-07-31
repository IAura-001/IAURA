"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BRAND_PALETTE_PRESETS,
  createBrandProfile,
  normalizeBrandColor,
} from "@/core/branding/brandProfile";
import { BrandMark } from "@/components/branding/BrandMark";
import { useI18n } from "@/core/i18n/I18nContext";
import type {
  BrandIconContainer,
  BrandLogoSystem,
  BrandPalette,
  BrandPersonality,
  BrandProfile,
  BrandSymbol,
  BrandSymbolWeight,
  BrandTypography,
  IAuraProject,
} from "@/types/project";

interface BrandingStudioProps {
  project: IAuraProject;
  onClose: () => void;
  onSave: (profile: BrandProfile) => void;
}

const PERSONALITY_OPTIONS: readonly {
  id: BrandPersonality;
  key:
    | "branding.personality.futuristic"
    | "branding.personality.human"
    | "branding.personality.premium"
    | "branding.personality.bold"
    | "branding.personality.serene"
    | "branding.personality.playful";
}[] = [
  { id: "futuristic", key: "branding.personality.futuristic" },
  { id: "human", key: "branding.personality.human" },
  { id: "premium", key: "branding.personality.premium" },
  { id: "bold", key: "branding.personality.bold" },
  { id: "serene", key: "branding.personality.serene" },
  { id: "playful", key: "branding.personality.playful" },
] as const;

const TYPOGRAPHY_OPTIONS: readonly {
  id: BrandTypography;
  key:
    | "branding.typography.modern"
    | "branding.typography.editorial"
    | "branding.typography.technical";
}[] = [
  { id: "modern", key: "branding.typography.modern" },
  { id: "editorial", key: "branding.typography.editorial" },
  { id: "technical", key: "branding.typography.technical" },
] as const;

const PALETTE_FIELDS: readonly {
  id: keyof BrandPalette;
  key:
    | "branding.palette.primary"
    | "branding.palette.secondary"
    | "branding.palette.accent"
    | "branding.palette.background"
    | "branding.palette.text";
}[] = [
  { id: "primary", key: "branding.palette.primary" },
  { id: "secondary", key: "branding.palette.secondary" },
  { id: "accent", key: "branding.palette.accent" },
  { id: "background", key: "branding.palette.background" },
  { id: "text", key: "branding.palette.text" },
] as const;

const TYPOGRAPHY_CLASS: Record<BrandTypography, string> = {
  modern: "font-sans tracking-tight",
  editorial: "font-serif tracking-normal",
  technical: "font-mono tracking-tight",
};

const SYMBOL_OPTIONS: readonly {
  id: BrandSymbol;
  key:
    | "branding.logo.symbol.spark"
    | "branding.logo.symbol.orbit"
    | "branding.logo.symbol.monogram"
    | "branding.logo.symbol.portal";
}[] = [
  { id: "spark", key: "branding.logo.symbol.spark" },
  { id: "orbit", key: "branding.logo.symbol.orbit" },
  { id: "monogram", key: "branding.logo.symbol.monogram" },
  { id: "portal", key: "branding.logo.symbol.portal" },
] as const;

const CONTAINER_OPTIONS: readonly {
  id: BrandIconContainer;
  key:
    | "branding.logo.container.squircle"
    | "branding.logo.container.circle"
    | "branding.logo.container.none";
}[] = [
  { id: "squircle", key: "branding.logo.container.squircle" },
  { id: "circle", key: "branding.logo.container.circle" },
  { id: "none", key: "branding.logo.container.none" },
] as const;

const WEIGHT_OPTIONS: readonly {
  id: BrandSymbolWeight;
  key:
    | "branding.logo.weight.light"
    | "branding.logo.weight.regular"
    | "branding.logo.weight.bold";
}[] = [
  { id: "light", key: "branding.logo.weight.light" },
  { id: "regular", key: "branding.logo.weight.regular" },
  { id: "bold", key: "branding.logo.weight.bold" },
] as const;

export default function BrandingStudio({
  project,
  onClose,
  onSave,
}: BrandingStudioProps) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<BrandProfile>(() =>
    createBrandProfile(project, {
      slogan: t("brand.identitySlogan"),
      mission: t("brand.identityMission"),
    })
  );
  const [saveState, setSaveState] = useState<
    "editing" | "saved"
  >(project.branding ? "saved" : "editing");
  const [paletteCopied, setPaletteCopied] =
    useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const previewBackground = useMemo(
    () =>
      `radial-gradient(circle at 75% 12%, ${profile.palette.accent}55, transparent 34%), linear-gradient(145deg, ${profile.palette.background} 10%, ${profile.palette.primary} 145%)`,
    [profile.palette]
  );

  function markEditing() {
    setSaveState("editing");
    setPaletteCopied(false);
  }

  function updateText(
    field: "brandName" | "slogan" | "mission",
    value: string
  ) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
    markEditing();
  }

  function updatePalette(
    field: keyof BrandPalette,
    value: string
  ) {
    setProfile((current) => ({
      ...current,
      palette: {
        ...current.palette,
        [field]: value,
      },
    }));
    markEditing();
  }

  function updateLogo<Field extends keyof BrandLogoSystem>(
    field: Field,
    value: BrandLogoSystem[Field]
  ) {
    setProfile((current) => ({
      ...current,
      logo: {
        ...current.logo,
        [field]: value,
      },
    }));
    markEditing();
  }

  function normalizePaletteField(
    field: keyof BrandPalette
  ) {
    setProfile((current) => ({
      ...current,
      palette: {
        ...current.palette,
        [field]: normalizeBrandColor(
          current.palette[field],
          BRAND_PALETTE_PRESETS[0].palette[field]
        ),
      },
    }));
  }

  function togglePersonality(
    personality: BrandPersonality
  ) {
    setProfile((current) => {
      const selected = current.personality.includes(personality);
      const nextPersonalities = selected
        ? current.personality.filter(
            (value) => value !== personality
          )
        : [
            ...current.personality.slice(-2),
            personality,
          ];

      return {
        ...current,
        personality: nextPersonalities,
      };
    });
    markEditing();
  }

  function applyPalette(palette: BrandPalette) {
    setProfile((current) => ({
      ...current,
      palette: { ...palette },
    }));
    markEditing();
  }

  async function copyPalette() {
    const paletteText = PALETTE_FIELDS.map(
      ({ id }) => `${id}: ${profile.palette[id]}`
    ).join("\n");

    try {
      await navigator.clipboard.writeText(paletteText);
      setPaletteCopied(true);
    } catch {
      setPaletteCopied(false);
    }
  }

  function saveProfile() {
    const normalizedProfile: BrandProfile = {
      ...profile,
      brandName:
        profile.brandName.trim() || project.name,
      slogan: profile.slogan.trim(),
      mission: profile.mission.trim(),
      palette: Object.fromEntries(
        PALETTE_FIELDS.map(({ id }) => [
          id,
          normalizeBrandColor(
            profile.palette[id],
            BRAND_PALETTE_PRESETS[0].palette[id]
          ),
        ])
      ) as unknown as BrandPalette,
      updatedAt: new Date().toISOString(),
    };

    setProfile(normalizedProfile);
    onSave(normalizedProfile);
    setSaveState("saved");
  }

  return (
    <section
      aria-label={t("branding.title")}
      className="fixed inset-0 z-[80] overflow-y-auto bg-[#05030a]/95 text-white backdrop-blur-2xl"
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-purple-700/20 blur-[130px]" />
        <div className="absolute bottom-[-14rem] right-[-10rem] h-[32rem] w-[32rem] rounded-full bg-blue-600/15 blur-[150px]" />
      </div>

      <div className="relative mx-auto min-h-screen w-full max-w-6xl px-4 py-5 sm:px-7 sm:py-8">
        <header className="mb-8 flex items-start justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-[0.68rem] uppercase tracking-[0.28em] text-purple-200/70">
              <span>{t("branding.eyebrow")}</span>
              <span className="h-1 w-1 rounded-full bg-purple-400" />
              <span>{project.name}</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("branding.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
              {t("branding.subtitle")}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("branding.close")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-xl text-white/70 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
          <div className="space-y-6">
            <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.24em] text-purple-300/80">
                  01 · {t("branding.foundationTitle")}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  {t("branding.foundationHint")}
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-white/60">
                  <span>{t("branding.name")}</span>
                  <input
                    value={profile.brandName}
                    onChange={(event) =>
                      updateText("brandName", event.target.value)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-purple-400/70 focus:ring-2 focus:ring-purple-500/15"
                  />
                </label>

                <label className="space-y-2 text-sm text-white/60">
                  <span>{t("branding.slogan")}</span>
                  <input
                    value={profile.slogan}
                    onChange={(event) =>
                      updateText("slogan", event.target.value)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-purple-400/70 focus:ring-2 focus:ring-purple-500/15"
                  />
                </label>
              </div>

              <label className="mt-5 block space-y-2 text-sm text-white/60">
                <span>{t("brand.identityMissionLabel")}</span>
                <textarea
                  value={profile.mission}
                  onChange={(event) =>
                    updateText("mission", event.target.value)
                  }
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-base leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-purple-400/70 focus:ring-2 focus:ring-purple-500/15"
                />
              </label>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-white/60">
                    {t("branding.personality")}
                  </span>
                  <span className="text-xs text-white/30">
                    {t("branding.personalityHint")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PERSONALITY_OPTIONS.map((option) => {
                    const selected = profile.personality.includes(
                      option.id
                    );

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => togglePersonality(option.id)}
                        className={`rounded-full border px-3.5 py-2 text-sm transition ${
                          selected
                            ? "border-purple-400/70 bg-purple-500/20 text-purple-100"
                            : "border-white/10 bg-white/[0.025] text-white/45 hover:border-white/25 hover:text-white/80"
                        }`}
                      >
                        {t(option.key)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6">
                <span className="mb-3 block text-sm text-white/60">
                  {t("branding.typography")}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {TYPOGRAPHY_OPTIONS.map((option) => {
                    const selected =
                      profile.typography === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setProfile((current) => ({
                            ...current,
                            typography: option.id,
                          }));
                          markEditing();
                        }}
                        className={`min-w-0 rounded-2xl border px-2 py-3 text-sm transition ${TYPOGRAPHY_CLASS[option.id]} ${
                          selected
                            ? "border-blue-400/70 bg-blue-500/15 text-blue-100"
                            : "border-white/10 bg-black/20 text-white/40 hover:text-white/75"
                        }`}
                      >
                        {t(option.key)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-blue-300/80">
                    02 · {t("branding.paletteTitle")}
                  </p>
                  <p className="mt-2 text-sm text-white/45">
                    {t("branding.paletteHint")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyPalette}
                  className="shrink-0 rounded-full border border-white/10 px-3 py-2 text-xs text-white/55 transition hover:border-white/25 hover:text-white"
                >
                  {paletteCopied
                    ? t("branding.copied")
                    : t("branding.copyPalette")}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BRAND_PALETTE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPalette(preset.palette)}
                    className="rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:-translate-y-0.5 hover:border-white/25"
                  >
                    <span className="mb-3 flex h-8 overflow-hidden rounded-lg">
                      {Object.values(preset.palette)
                        .slice(0, 4)
                        .map((color) => (
                          <span
                            key={color}
                            className="h-full flex-1"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                    </span>
                    <span className="text-xs text-white/60">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {PALETTE_FIELDS.map((field) => (
                  <label
                    key={field.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"
                  >
                    <input
                      type="color"
                      value={normalizeBrandColor(
                        profile.palette[field.id],
                        BRAND_PALETTE_PRESETS[0].palette[field.id]
                      )}
                      aria-label={t(field.key)}
                      onChange={(event) =>
                        updatePalette(field.id, event.target.value.toUpperCase())
                      }
                      className="h-11 w-11 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-white/35">
                        {t(field.key)}
                      </span>
                      <input
                        value={profile.palette[field.id]}
                        onChange={(event) =>
                          updatePalette(field.id, event.target.value)
                        }
                        onBlur={() => normalizePaletteField(field.id)}
                        maxLength={7}
                        className="mt-0.5 w-full bg-transparent font-mono text-sm uppercase text-white/80 outline-none"
                      />
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-300/80">
                  03 · {t("branding.logoTitle")}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  {t("branding.logoHint")}
                </p>
              </div>

              <div>
                <span className="mb-3 block text-sm text-white/60">
                  {t("branding.logoSymbolLabel")}
                </span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {SYMBOL_OPTIONS.map((option) => {
                    const selected = profile.logo.symbol === option.id;
                    const previewLogo = {
                      ...profile.logo,
                      symbol: option.id,
                    };

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => updateLogo("symbol", option.id)}
                        className={`flex min-w-0 flex-col items-center gap-3 rounded-2xl border px-3 py-4 text-xs transition ${
                          selected
                            ? "border-fuchsia-400/70 bg-fuchsia-500/15 text-fuchsia-100"
                            : "border-white/10 bg-black/20 text-white/45 hover:border-white/25 hover:text-white/80"
                        }`}
                      >
                        <BrandMark
                          brandName={profile.brandName || project.name}
                          logo={previewLogo}
                          palette={profile.palette}
                          size={48}
                        />
                        <span className="truncate">{t(option.key)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <span className="mb-3 block text-sm text-white/60">
                    {t("branding.logoContainerLabel")}
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {CONTAINER_OPTIONS.map((option) => {
                      const selected = profile.logo.container === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => updateLogo("container", option.id)}
                          className={`rounded-xl border px-2 py-2.5 text-xs transition ${
                            selected
                              ? "border-blue-400/70 bg-blue-500/15 text-blue-100"
                              : "border-white/10 bg-black/20 text-white/40 hover:text-white/75"
                          }`}
                        >
                          {t(option.key)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="mb-3 block text-sm text-white/60">
                    {t("branding.logoWeightLabel")}
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {WEIGHT_OPTIONS.map((option) => {
                      const selected = profile.logo.weight === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => updateLogo("weight", option.id)}
                          className={`rounded-xl border px-2 py-2.5 text-xs transition ${
                            selected
                              ? "border-purple-400/70 bg-purple-500/15 text-purple-100"
                              : "border-white/10 bg-black/20 text-white/40 hover:text-white/75"
                          }`}
                        >
                          {t(option.key)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-purple-950/20 sm:p-5">
              <div className="mb-4 flex items-center justify-between px-1">
                <span className="text-xs uppercase tracking-[0.24em] text-white/35">
                  {t("branding.previewTitle")}
                </span>
                <span
                  className={`flex items-center gap-2 text-xs ${
                    saveState === "saved"
                      ? "text-emerald-300/80"
                      : "text-amber-200/60"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {saveState === "saved"
                    ? t("branding.saved")
                    : t("branding.unsaved")}
                </span>
              </div>

              <div
                className="relative min-h-[31rem] overflow-hidden rounded-[1.6rem] border border-white/10 p-7 shadow-inner sm:p-9"
                style={{
                  background: previewBackground,
                  color: profile.palette.text,
                }}
              >
                <div
                  className="absolute -right-16 -top-16 h-52 w-52 rounded-full blur-3xl"
                  style={{ backgroundColor: `${profile.palette.secondary}88` }}
                />
                <div className="relative flex h-full min-h-[27rem] flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.62rem] uppercase tracking-[0.32em] opacity-65">
                      Brand system · 01
                    </span>
                    <span
                      className="h-2.5 w-2.5 rounded-full shadow-[0_0_20px_currentColor]"
                      style={{ color: profile.palette.accent, backgroundColor: profile.palette.accent }}
                    />
                  </div>

                  <div className="my-auto py-12">
                    <BrandMark
                      brandName={profile.brandName || project.name}
                      logo={profile.logo}
                      palette={profile.palette}
                      size={72}
                      className="mb-7"
                    />
                    <h2
                      className={`break-words text-4xl font-semibold sm:text-5xl ${TYPOGRAPHY_CLASS[profile.typography]}`}
                    >
                      {profile.brandName || project.name}
                    </h2>
                    <p className="mt-4 max-w-sm text-base leading-7 opacity-70">
                      {profile.slogan || t("brand.identitySlogan")}
                    </p>
                  </div>

                  <div>
                    <div className="mb-5 flex gap-2">
                      {profile.personality.map((personality) => {
                        const option = PERSONALITY_OPTIONS.find(
                          (candidate) => candidate.id === personality
                        );

                        return option ? (
                          <span
                            key={personality}
                            className="rounded-full border px-2.5 py-1 text-[0.65rem] uppercase tracking-wider opacity-65"
                            style={{ borderColor: `${profile.palette.text}28` }}
                          >
                            {t(option.key)}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <button
                      type="button"
                      className="w-full rounded-2xl px-5 py-3.5 text-sm font-semibold shadow-xl"
                      style={{
                        backgroundColor: profile.palette.accent,
                        color: profile.palette.background,
                      }}
                    >
                      {t("branding.previewCta")} →
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
                <p className="mb-4 text-[0.62rem] uppercase tracking-[0.24em] text-white/35">
                  {t("branding.logoUsageTitle")}
                </p>
                <div className="grid grid-cols-[auto_auto_1fr] items-end gap-4">
                  <div className="text-center">
                    <BrandMark
                      brandName={profile.brandName || project.name}
                      logo={profile.logo}
                      palette={profile.palette}
                      size={56}
                    />
                    <span className="mt-2 block text-[0.6rem] text-white/35">
                      {t("branding.logoAppIcon")}
                    </span>
                  </div>
                  <div className="text-center">
                    <BrandMark
                      brandName={profile.brandName || project.name}
                      logo={profile.logo}
                      palette={profile.palette}
                      size={34}
                    />
                    <span className="mt-2 block text-[0.6rem] text-white/35">
                      {t("branding.logoFavicon")}
                    </span>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex items-center gap-2.5">
                      <BrandMark
                        brandName={profile.brandName || project.name}
                        logo={{ ...profile.logo, container: "none" }}
                        palette={profile.palette}
                        size={30}
                      />
                      <span className={`truncate text-sm font-semibold ${TYPOGRAPHY_CLASS[profile.typography]}`}>
                        {profile.brandName || project.name}
                      </span>
                    </div>
                    <span className="mt-2 block text-[0.6rem] text-white/35">
                      {t("branding.logoWordmark")}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={saveProfile}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-blue-600 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-purple-950/40 transition hover:brightness-110 active:scale-[0.99]"
              >
                {saveState === "saved"
                  ? `✓ ${t("branding.saved")}`
                  : t("branding.save")}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
