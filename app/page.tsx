"use client";
import { MISSIONS } from "@/constants/missions";
import { useState } from "react";
import { APP_NAME, APP_TAGLINE } from "@/constants/app";
import { theme } from "@/config/theme";
import AssistantCard from "@/components/sections/AssistantCard";
import Hero from "@/components/sections/Hero";
import ModeSelector from "@/components/sections/ModeSelector";
import Navbar from "@/components/sections/Navbar";
import type { AppMode } from "@/types/app";

const modes: AppMode[] = [
  {
    id: "learn",
    name: "Aprender",
    icon: "✦",
    description: "Aura te guía con preguntas, pistas y práctica.",
  },
  {
    id: "build",
    name: "Construir",
    icon: "⬡",
    description: "Convierte una idea en un proyecto ejecutable.",
  },
  {
    id: "founder",
    name: "Founder",
    icon: "◇",
    description: "Estrategia, decisiones y progreso para IAURA.",
  },
  {
    id: "solve",
    name: "Resolver",
    icon: "◈",
    description: "Obtén ayuda directa cuando necesitas avanzar rápido.",
  },
];

export default function Home() {
  const [selectedMode, setSelectedMode] = useState("learn");

  const activeMode =

    modes.find((mode) => mode.id === selectedMode) ?? modes[0];

    const completedMissions = MISSIONS.filter(
  (mission) => mission.completed
);



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
            modes={modes}
            selectedMode={selectedMode}
            onSelect={setSelectedMode}
          />
        </div>

        <AssistantCard
          modeName={activeMode.name}
          modeIcon={activeMode.icon}
        /><div className="lg:col-span-2">
  <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs tracking-[0.25em] text-zinc-500">
          DEVELOPMENT LOG
        </p>

        <h2 className="mt-2 text-2xl font-semibold">
          Misiones completadas
        </h2>
      </div>

      <span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-4 py-2 text-sm text-purple-300">
        {completedMissions.length}
      </span>
    </div>

    <div className="mt-6 grid gap-3 md:grid-cols-2">
      {completedMissions.map((mission) => (
        <div
          key={mission.id}
          className="rounded-2xl border border-white/10 bg-black/30 p-5"
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

            <span className="text-green-400">✓</span>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
      </section>
    </main>
  );
}