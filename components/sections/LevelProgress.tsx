import {
  getExperienceProgress,
  getLevelFromExperience,
} from "@/utils/level";

type LevelProgressProps = {
  experience: number;
};

export default function LevelProgress({
  experience,
}: LevelProgressProps) {
  const level = getLevelFromExperience(experience);
  const progress = getExperienceProgress(experience);

  return (
    <div className="lg:col-span-2">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs tracking-[0.25em] text-zinc-500">
              FOUNDER LEVEL
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              Level {level}
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              {progress} / 100 XP toward the next level
            </p>
          </div>

          <span className="text-3xl font-bold text-purple-300">
            {progress} XP
          </span>
        </div>

        <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}