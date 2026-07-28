"use client";
import LevelProgress from "@/components/sections/LevelProgress";
import ProfileSettings from "@/components/sections/ProfileSettings";
import DailyQuote from "@/components/sections/DailyQuote";
import { MISSIONS } from "@/constants/missions";
import { useState } from "react";
import DailyFocus from "@/components/sections/DailyFocus";
import { theme } from "@/config/theme";
import DashboardGreeting from "@/components/sections/DashboardGreeting";
import AssistantCard from "@/components/sections/AssistantCard";
import Hero from "@/components/sections/Hero";
import ModeSelector from "@/components/sections/ModeSelector";
import Navbar from "@/components/sections/Navbar";
import ProgressSummary from "@/components/sections/ProgressSummary";
import MissionList from "@/components/sections/MissionList";
import { MODES } from "@/constants/modes";
import StatsGrid from "@/components/sections/StatsGrid";
import { useMemory } from "@/hooks/useMemory";
export default function Home() {
  const [selectedMode, setSelectedMode] = useState("learn");
const {
  memory,
  isLoaded,
  updateMemory,
  addExperience,
  markMissionComplete,
  resetMemory,
} = useMemory();
const activeMode =
  MODES.find((mode) => mode.id === selectedMode) ?? MODES[0];

const completedMissionIds = memory.completedMissionIds ?? [];

const completedMissions = MISSIONS.filter((mission) =>
  completedMissionIds.includes(mission.id)
);

const pendingMissions = MISSIONS.filter(
  (mission) => !completedMissionIds.includes(mission.id)
);

const recentMissions = completedMissions.slice(-3).reverse();

if (!isLoaded) {
  return (
    <main
      className="flex min-h-screen items-center justify-center text-white"
      style={{ backgroundColor: theme.colors.background }}
    >
      Loading IAURA...
    </main>
  );
}

return (
  <main
    className="relative min-h-screen overflow-hidden px-6 text-white"
    style={{ backgroundColor: theme.colors.background }}
  >
      <div className="absolute left-[-150px] top-[-150px] h-[420px] w-[420px] rounded-full bg-purple-700/20 blur-[130px]" />

      <div className="absolute bottom-[-180px] right-[-120px] h-[400px] w-[400px] rounded-full bg-blue-600/15 blur-[130px]" />

      <Navbar />

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-120px)] w-full max-w-6xl items-center gap-14 py-12 lg:grid-cols-2">
        <div>
          <Hero />

          <ModeSelector
            modes={MODES}
            selectedMode={selectedMode}
            onSelect={setSelectedMode}
          />
        </div>

        <AssistantCard
        modeName={activeMode.name}
         modeIcon={activeMode.icon}
/>
<DashboardGreeting name={memory.userName} />
<ProfileSettings
  userName={memory.userName}
  onSaveName={(name) =>
    updateMemory({
      userName: name,
    })
  }
/>
<DailyFocus />

<ProgressSummary
  completed={completedMissions.length}
  total={MISSIONS.length}
/>

<LevelProgress experience={memory.experience} onEarnXP={() => addExperience(25)} />
<button
  type="button"
  onClick={resetMemory}
  className="rounded-xl bg-red-600 px-4 py-2 text-white hover:bg-red-500"
>
  Reset IAURA Memory
</button>
<StatsGrid
  completed={completedMissions.length}
  total={MISSIONS.length}
/>
<DailyQuote />
<MissionList
  missions={pendingMissions}
  completedMissionIds={memory.completedMissionIds ?? []}
  onComplete={(missionId) => markMissionComplete(missionId, 25)}
/>
    
      
      </section>
    </main>
  );
}