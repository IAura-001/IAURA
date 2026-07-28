import type { Mission } from "@/types/mission";

type MissionCardProps = {
  mission: Mission;
};

export default function MissionCard({ mission }: MissionCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
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

        <span className="text-green-400">✓</span>
      </div>
    </div>
  );
}