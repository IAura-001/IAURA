"use client";
import LevelProgress from "@/components/sections/LevelProgress";
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
const { memory, isLoaded, addExperience, markMissionComplete } = useMemory();
const activeMode =
  MODES.find((mode) => mode.id === selectedMode) ?? MODES[0];

const completedMissions = MISSIONS.filter(
  (mission) => mission.completed
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

<DailyFocus />

<ProgressSummary
  completed={completedMissions.length}
  total={MISSIONS.length}
/>

<LevelProgress experience={memory.experience} onEarnXP={() => addExperience(25)} />
<button
  type="button"
  onClick={() => markMissionComplete("023", 25)}
  disabled={(memory.completedMissionIds ?? []).includes("023")}
  className="lg:col-span-2 rounded-2xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
>
  {(memory.completedMissionIds ?? []).includes("023")
    ? "Mission 023 Completed"
    : "Complete Mission 023 +25 XP"}
</button>
<StatsGrid
  completed={completedMissions.length}
  total={MISSIONS.length}
/>
<DailyQuote />
<MissionList missions={recentMissions} />
    
      
      </section>
    </main>
  );
}