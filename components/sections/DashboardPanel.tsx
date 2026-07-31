"use client";

import DashboardGreeting from "@/components/sections/DashboardGreeting";
import GoalsManager from "@/components/sections/GoalsManager";
import ProfileSettings from "@/components/sections/ProfileSettings";
import HabitsManager from "@/components/sections/HabitsManager";
import DailyIntelligence from "@/components/sections/DailyIntelligence";
import DailyFocus from "@/components/sections/DailyFocus";
import ProgressSummary from "@/components/sections/ProgressSummary";
import LevelProgress from "@/components/sections/LevelProgress";
import StatsGrid from "@/components/sections/StatsGrid";
import PerformancePanel from "@/components/sections/PerformancePanel";
import DailyQuote from "@/components/sections/DailyQuote";
import MissionList from "@/components/sections/MissionList";
import type { Mission } from "@/types/mission";

type PriorityItem = {
  title: string;
  score: number;
};

interface DashboardPanelProps {
  name: string;
  goals: string[];
  onSaveName: (name: string) => void;
  onAddGoal: (goal: string) => void;
  onRemoveGoal: (goalIndex: number) => void;
  habits: string[];
  onAddHabit: (habit: string) => void;
  onRemoveHabit: (habitIndex: number) => void;
  priorities: PriorityItem[];
  recommendation: string;
  completedCount: number;
  totalMissions: number;
  experience: number;
  onEarnXP: () => void;
  onResetMemory: () => void;
  messageCount: number;
  goalsCount: number;
  habitsCount: number;
  missions: Mission[];
  completedMissionIds: string[];
  onMissionComplete: (missionId: string) => void;
}

export default function DashboardPanel({
  name,
  goals,
  onSaveName,
  onAddGoal,
  onRemoveGoal,
  habits,
  onAddHabit,
  onRemoveHabit,
  priorities,
  recommendation,
  completedCount,
  totalMissions,
  experience,
  onEarnXP,
  onResetMemory,
  messageCount,
  goalsCount,
  habitsCount,
  missions,
  completedMissionIds,
  onMissionComplete,
}: DashboardPanelProps) {
  return (
    <>
      <DashboardGreeting name={name} />

      <ProfileSettings
        userName={name}
        onSaveName={onSaveName}
      />

      <GoalsManager
        goals={goals}
        onAddGoal={onAddGoal}
        onRemoveGoal={onRemoveGoal}
      />

      <HabitsManager
        habits={habits}
        onAddHabit={onAddHabit}
        onRemoveHabit={onRemoveHabit}
      />

      <DailyIntelligence
        priorities={priorities}
        recommendation={recommendation}
      />

      <DailyFocus />

      <ProgressSummary
        completed={completedCount}
        total={totalMissions}
      />

      <LevelProgress
        experience={experience}
        onEarnXP={onEarnXP}
      />

      <button
        type="button"
        onClick={onResetMemory}
        className="rounded-xl bg-red-600 px-4 py-2 text-white hover:bg-red-500"
      >
        Reset IAURA Memory
      </button>

      <StatsGrid
        completed={completedCount}
        total={totalMissions}
      />

      <PerformancePanel
        messageCount={messageCount}
        goalsCount={goalsCount}
        habitsCount={habitsCount}
      />

      <DailyQuote />

      <MissionList
        missions={missions}
        completedMissionIds={completedMissionIds}
        onComplete={onMissionComplete}
      />
    </>
  );
}