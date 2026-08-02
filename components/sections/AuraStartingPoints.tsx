"use client";

import { useState } from "react";

import { useI18n } from "@/core/i18n/I18nContext";
import { getAuraStarterPaths } from "@/core/experience/starterPaths";

interface AuraStartingPointsProps {
  disabled?: boolean;
  onSelect: (prompt: string) => void | Promise<void>;
}

const copy = {
  "es-419": {
    eyebrow: "UNA INTELIGENCIA · MUCHAS FORMAS DE AVANZAR",
    title: "Empieza con tu voz.",
    description:
      "Díselo a Aura con tus palabras o toca un punto de partida. Ella organiza la ruta; tú eliges lo que sigue.",
  },
  "en-US": {
    eyebrow: "ONE INTELLIGENCE · MANY WAYS FORWARD",
    title: "Start with your voice.",
    description:
      "Tell Aura in your own words or choose a starting point. She organizes the route; you choose what follows.",
  },
  "pt-BR": {
    eyebrow: "UMA INTELIGÊNCIA · MUITAS FORMAS DE AVANÇAR",
    title: "Comece com sua voz.",
    description:
      "Fale com Aura do seu jeito ou escolha um ponto de partida. Ela organiza a rota; você escolhe o próximo passo.",
  },
  "fr-FR": {
    eyebrow: "UNE INTELLIGENCE · PLUSIEURS FAÇONS D’AVANCER",
    title: "Commencez avec votre voix.",
    description:
      "Parlez à Aura avec vos mots ou choisissez un point de départ. Elle organise le parcours; vous choisissez la suite.",
  },
} as const;

export default function AuraStartingPoints({
  disabled = false,
  onSelect,
}: AuraStartingPointsProps) {
  const { locale } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const paths = getAuraStarterPaths(locale);
  const text = copy[locale];

  async function selectPath(id: string, prompt: string): Promise<void> {
    if (disabled || selectedId) return;

    setSelectedId(id);
    try {
      await onSelect(prompt);
    } finally {
      setSelectedId(null);
    }
  }

  return (
    <section className="mt-6" aria-labelledby="aura-starting-points-title">
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-violet-200/55">
        {text.eyebrow}
      </p>
      <h2 id="aura-starting-points-title" className="mt-2 text-xl font-medium text-zinc-100">
        {text.title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
        {text.description}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {paths.map((path) => {
          const isSelected = selectedId === path.id;

          return (
            <button
              key={path.id}
              type="button"
              onClick={() => void selectPath(path.id, path.prompt)}
              disabled={disabled || Boolean(selectedId)}
              aria-busy={isSelected}
              data-state={isSelected ? "loading" : "ready"}
              className="group min-h-[5.25rem] touch-manipulation rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 text-left transition hover:border-violet-300/25 hover:bg-violet-400/[0.055] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <span className="flex items-start gap-3">
                <span className="mt-0.5 font-mono text-[9px] tracking-[0.16em] text-violet-300/65">
                  {isSelected ? "···" : path.icon}
                </span>
                <span>
                  <span className="block text-sm font-medium text-zinc-100">
                    {path.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">
                    {path.description}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
