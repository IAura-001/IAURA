"use client";

import { useI18n } from "@/core/i18n/I18nContext";
import type { MessageKey } from "@/core/i18n/messages";

type Mode = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

type ModeSelectorProps = {
  modes: Mode[];
  selectedMode: string;
  onSelect: (modeId: string) => void;
};

export default function ModeSelector({
  modes,
  selectedMode,
  onSelect,
}: ModeSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="mt-6 grid grid-cols-2 gap-2.5">
      {modes.map((mode) => {
        const selected = selectedMode === mode.id;

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onSelect(mode.id)}
            aria-pressed={selected}
            className={`min-h-16 rounded-2xl border p-3.5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 sm:min-h-24 sm:p-4 ${
              selected
                ? "border-violet-300/35 bg-violet-400/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                : "border-white/[0.07] bg-white/[0.025] hover:border-violet-300/20 hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base text-violet-300/85" aria-hidden="true">
                {mode.icon}
              </span>

              <h3 className="text-sm font-medium text-zinc-100">
                {t(
                  `mode.${mode.id}.name` as MessageKey
                )}
              </h3>
            </div>

            <p className="sr-only text-xs leading-5 text-zinc-500 sm:not-sr-only sm:mt-2 sm:block">
              {t(
                `mode.${mode.id}.description` as MessageKey
              )}
            </p>
          </button>
        );
      })}
    </div>
  );
}
