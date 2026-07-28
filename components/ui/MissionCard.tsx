import type { Mission } from "@/types/mission";

type MissionCardProps = {
  mission: Mission;
  isCompleted: boolean;
  onComplete: (missionId: string) => void;
};

export default function MissionCard({ mission, isCompleted, onComplete }: MissionCardProps) {
  return (
  <button
    type="button"
    onClick={() => onComplete(mission.id)}
    disabled={isCompleted}
    className="w-full rounded-2xl border border-white/10 bg-black/30 p-5 text-left transition hover:border-purple-400/30 hover:bg-white/[0.04] disabled:cursor-default disabled:opacity-70"
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-medium text-purple-300">
          Mission {mission.id}
        </p>

        <h3 className="mt-2 font-semibold text-white">
          {mission.title}
        </h3>

        <p className="mt-2 text-sm leading-6 text-zinc-500">
          {mission.description}
        </p>
      </div>

      <span
        className={
          isCompleted
            ? "text-green-400"
            : "text-zinc-600"
        }
      >
        {isCompleted ? "✓" : "○"}
      </span>
    </div>
  </button>
);
}