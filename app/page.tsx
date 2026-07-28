"use client";

import { useState } from "react";
import { APP_NAME, APP_TAGLINE } from "@/constants/app";
import { theme } from "@/config/theme";
import type { Mode } from "@/types/app";
import AssistantCard from "@/components/sections/AssistantCard";
import Hero from "@/components/sections/Hero";
import ModeSelector from "@/components/sections/ModeSelector";
import Navbar from "@/components/sections/Navbar";

const modes = [
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
        />
      </section>
    </main>
  );
}