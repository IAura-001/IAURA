import MissionCard from "@/components/ui/MissionCard";
import type { Mission } from "@/types/mission";

type MissionListProps = {
  missions: Mission[];
  completedMissionIds: string[];
  onComplete: (missionId: string) => void;
};

export default function MissionList({
  missions,
  completedMissionIds,
  onComplete,
}: MissionListProps) {
  return (
    <div className="lg:col-span-2">
      <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-[0.25em] text-zinc-500">
              MISSION QUEUE
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Available Missions
            </h2>
          </div>

          <span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-4 py-2 text-sm text-purple-300">
            {missions.length}
          </span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {missions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              isCompleted={completedMissionIds.includes(mission.id)}
              onComplete={onComplete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}