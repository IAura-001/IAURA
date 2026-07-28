"use client";

import { MISSIONS } from "@/constants/missions";
import { useState } from "react";

import { theme } from "@/config/theme";

import AssistantCard from "@/components/sections/AssistantCard";
import Hero from "@/components/sections/Hero";
import ModeSelector from "@/components/sections/ModeSelector";
import Navbar from "@/components/sections/Navbar";
import ProgressSummary from "@/components/sections/ProgressSummary";
import MissionList from "@/components/sections/MissionList";
import { MODES } from "@/constants/modes";
import StatsGrid from "@/components/sections/StatsGrid";
export default function Home() {
  const [selectedMode, setSelectedMode] = useState("learn");

const activeMode =
  MODES.find((mode) => mode.id === selectedMode) ?? MODES[0];

const completedMissions = MISSIONS.filter(
  (mission) => mission.completed
);
const recentMissions = completedMissions.slice(-3).reverse();
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

<ProgressSummary
  completed={completedMissions.length}
  total={MISSIONS.length}
/>
<StatsGrid
  completed={completedMissions.length}
  total={MISSIONS.length}
/>
<MissionList missions={recentMissions} />
    
      
      </section>
    </main>
  );
}