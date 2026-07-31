"use client";

import {
  getExperienceProgress,
  getLevelFromExperience,
} from "@/utils/level";
import { useI18n } from "@/core/i18n/I18nContext";

type LevelProgressProps = {
  experience: number;
  onEarnXP: () => void;
};

export default function LevelProgress({
  experience,
  onEarnXP,
}: LevelProgressProps) {
  const { t } = useI18n();
  const level = getLevelFromExperience(experience);
  const progress = getExperienceProgress(experience);

  return (
    <div className="lg:col-span-2">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs tracking-[0.25em] text-zinc-500">
              {t("level.eyebrow")}
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              {t("level.title", { level })}
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              {t("level.next", { progress })}
            </p>
          </div>

          <span className="text-3xl font-bold text-purple-300">
            {progress} XP
          </span>
        </div>

        <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <button
          type="button"
          onClick={onEarnXP}
          className="mt-5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
        >
          {t("level.action")}
        </button>
      </div>
    </div>
  );
}
