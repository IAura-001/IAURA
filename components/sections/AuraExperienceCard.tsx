"use client";

import { useState } from "react";

import type {
  AuraExperience,
  AuraExperienceChoice,
  AuraExperienceSurface,
  BetaIncompleteExecutionRecoveryDecision,
} from "@/core/actions";
import { useI18n } from "@/core/i18n/I18nContext";

interface AuraExperienceCardProps {
  experience: AuraExperience;
  sourceMessageId: string;
  disabled?: boolean;
  onChoose?: (choice: AuraExperienceChoice, sourceMessageId: string) => void | Promise<void>;
  onOpenSurface?: (surface: AuraExperienceSurface) => void;
  showChoices?: boolean;
  confirmedRecoveryDecision?: BetaIncompleteExecutionRecoveryDecision;
}

const copy = {
  "es-419": {
    route: "RUTA PROPUESTA",
    next: "ELIGE LO QUE SIGUE",
    open: "Abrir espacio recomendado",
    chosen: "Elegido",
    surfaces: {
      none: "",
      presence: "Seguir con Aura",
      projects: "Abrir proyectos",
      intelligence: "Abrir metas e inteligencia",
      "creative-direction": "Abrir dirección creativa",
      "creative-image": "Abrir Image Lab",
      "creative-website": "Abrir Website Kit",
      "creative-library": "Abrir biblioteca visual",
      launch: "Abrir Launch Studio",
    },
  },
  "en-US": {
    route: "PROPOSED ROUTE",
    next: "CHOOSE WHAT FOLLOWS",
    open: "Open recommended space",
    chosen: "Chosen",
    surfaces: {
      none: "",
      presence: "Continue with Aura",
      projects: "Open projects",
      intelligence: "Open goals and intelligence",
      "creative-direction": "Open creative direction",
      "creative-image": "Open Image Lab",
      "creative-website": "Open Website Kit",
      "creative-library": "Open visual library",
      launch: "Open Launch Studio",
    },
  },
  "pt-BR": {
    route: "ROTA PROPOSTA",
    next: "ESCOLHA O PRÓXIMO PASSO",
    open: "Abrir espaço recomendado",
    chosen: "Escolhido",
    surfaces: {
      none: "",
      presence: "Continuar com Aura",
      projects: "Abrir projetos",
      intelligence: "Abrir metas e inteligência",
      "creative-direction": "Abrir direção criativa",
      "creative-image": "Abrir Image Lab",
      "creative-website": "Abrir Website Kit",
      "creative-library": "Abrir biblioteca visual",
      launch: "Abrir Launch Studio",
    },
  },
  "fr-FR": {
    route: "PARCOURS PROPOSÉ",
    next: "CHOISISSEZ LA SUITE",
    open: "Ouvrir l’espace recommandé",
    chosen: "Choisi",
    surfaces: {
      none: "",
      presence: "Continuer avec Aura",
      projects: "Ouvrir les projets",
      intelligence: "Ouvrir les objectifs et l’intelligence",
      "creative-direction": "Ouvrir la direction créative",
      "creative-image": "Ouvrir Image Lab",
      "creative-website": "Ouvrir Website Kit",
      "creative-library": "Ouvrir la bibliothèque visuelle",
      launch: "Ouvrir Launch Studio",
    },
  },
} as const;

export default function AuraExperienceCard({
  experience,
  sourceMessageId,
  disabled = false,
  onChoose,
  onOpenSurface,
  showChoices = true,
  confirmedRecoveryDecision,
}: AuraExperienceCardProps) {
  const { locale } = useI18n();
  const text = copy[locale];
  const [pendingChoice, setPendingChoice] = useState<number | null>(null);
  const [chosenChoice, setChosenChoice] = useState<number | null>(null);
  const [surfaceOpened, setSurfaceOpened] = useState(false);
  const hasContent = Boolean(
    experience.title ||
      experience.summary ||
      experience.phases.length ||
      experience.choices.length ||
      experience.recommendedSurface !== "none",
  );

  if (!hasContent) return null;

  async function choose(index: number, choice: AuraExperienceChoice): Promise<void> {
    if (!onChoose || disabled || pendingChoice !== null) return;

    setPendingChoice(index);
    try {
      await onChoose(choice, sourceMessageId);
      setChosenChoice(index);
    } catch {
      // HomePage already renders the existing conversation error state.
    } finally {
      setPendingChoice(null);
    }
  }

  function openSurface(surface: AuraExperienceSurface): void {
    if (!onOpenSurface || disabled) return;
    setSurfaceOpened(true);
    onOpenSurface(surface);
  }

  return (
    <section data-nested-surface="dark" className="mt-5 overflow-hidden rounded-[22px] border border-[var(--iaura-rich-dark-border,rgba(196,181,253,.2))] bg-[var(--iaura-rich-dark-surface,#090811)] text-[var(--iaura-rich-dark-text,#f7f5fa)] shadow-[0_16px_42px_rgba(20,5,45,0.14)]">
      <div className="border-b border-white/[0.07] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[rgb(var(--iaura-accent-rgb,216,180,254))]">
            {text.route}
          </span>
          <span className="rounded-full bg-[var(--iaura-rich-dark-elevated)] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--iaura-rich-dark-muted)]">
            {experience.kind.replace("-", " ")}
          </span>
        </div>
        {experience.title ? (
          <h3 className="mt-3 text-xl font-medium text-[var(--iaura-rich-dark-text)]">
            {experience.title}
          </h3>
        ) : null}
        {experience.summary ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--iaura-rich-dark-secondary)]">
            {experience.summary}
          </p>
        ) : null}
      </div>

      {experience.phases.length ? (
        <ol className="grid border-y border-[var(--iaura-rich-dark-border)] sm:grid-cols-2 xl:grid-cols-3">
          {experience.phases.map((phase, index) => (
            <li key={`${phase.title}-${index}`} className="border-b border-[var(--iaura-rich-dark-border)] p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:p-5 sm:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(3n)]:border-r-0">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-300/20 bg-violet-400/[0.07] font-mono text-[9px] text-violet-200">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--iaura-rich-dark-text)]">
                    {phase.title}
                  </p>
                  {phase.description ? (
                    <p className="mt-1 text-xs leading-5 text-[var(--iaura-rich-dark-muted)]">
                      {phase.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {confirmedRecoveryDecision ? (
        <p className="border-t border-[var(--iaura-rich-dark-border)] px-5 py-4 text-sm text-[var(--iaura-rich-dark-secondary)] sm:px-6">
          {confirmedRecoveryDecision === "retry-now"
            ? "Reintento listo para el mismo paso confirmado. La evidencia anterior permanece registrada."
            : "Continuación aplazada para el mismo paso confirmado. La evidencia anterior permanece registrada."}
        </p>
      ) : null}

      {((showChoices && !confirmedRecoveryDecision && experience.choices.length) ||
        experience.recommendedSurface !== "none") ? (
        <div className="space-y-3 p-5 sm:p-6">
          {showChoices && !confirmedRecoveryDecision && experience.choices.length ? (
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--iaura-rich-dark-muted)]">
              {text.next}
            </p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            {showChoices && !confirmedRecoveryDecision ? experience.choices.map((choice, index) => {
              const isPending = pendingChoice === index;
              const isChosen = chosenChoice === index;

              return (
                <button
                  key={`${choice.label}-${index}`}
                  type="button"
                  onClick={() => void choose(index, choice)}
                  disabled={disabled || !onChoose || pendingChoice !== null}
                  aria-pressed={isChosen}
                  aria-busy={isPending}
                  data-state={isPending ? "loading" : isChosen ? "selected" : "ready"}
                  className="min-h-[4.75rem] touch-manipulation rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--iaura-rich-dark-elevated)_58%,transparent)] p-3.5 text-left transition hover:border-[var(--iaura-rich-dark-border)] hover:bg-[var(--iaura-rich-dark-elevated)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus,var(--vaeora-focus))] disabled:cursor-not-allowed disabled:saturate-50 motion-reduce:transform-none motion-reduce:transition-none"
                >
                  <span className="flex items-center justify-between gap-3 text-sm font-medium text-[var(--iaura-rich-dark-text)]">
                    <span>{choice.label}</span>
                    <span aria-hidden="true" className="text-violet-300/70">
                      {isPending ? "···" : isChosen ? "✓" : "→"}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--iaura-rich-dark-muted)]">
                    {isChosen ? text.chosen : choice.description}
                  </span>
                </button>
              );
            }) : null}
          </div>

          {experience.recommendedSurface !== "none" ? (
            <button
              type="button"
              onClick={() => openSurface(experience.recommendedSurface)}
              disabled={disabled || !onOpenSurface}
              aria-pressed={surfaceOpened}
              data-state={surfaceOpened ? "selected" : "ready"}
              className="flex min-h-12 w-full touch-manipulation items-center justify-between rounded-2xl border border-[var(--iaura-rich-dark-border)] bg-[var(--iaura-rich-action)] px-4 py-3 text-sm font-medium text-[var(--iaura-rich-action-text)] transition hover:brightness-110 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus,var(--vaeora-focus))] disabled:cursor-not-allowed disabled:saturate-50 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <span>
                {surfaceOpened ? "✓ " : ""}
                {text.surfaces[experience.recommendedSurface] || text.open}
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
