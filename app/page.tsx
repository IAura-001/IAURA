"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
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

  const activeMode = modes.find((mode) => mode.id === selectedMode);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07050d] px-6 text-white">
      <div className="absolute left-[-150px] top-[-150px] h-[420px] w-[420px] rounded-full bg-purple-700/20 blur-[130px]" />

      <div className="absolute bottom-[-180px] right-[-120px] h-[400px] w-[400px] rounded-full bg-blue-600/15 blur-[130px]" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between py-8">
        <div>
          <p className="text-lg font-bold tracking-[0.35em] text-white">
            IAURA
          </p>

          <p className="mt-1 text-[10px] tracking-[0.25em] text-zinc-500">
            ENGINEERING INTELLIGENT FUTURES
          </p>
        </div>

        <div className="rounded-full border border-purple-400/20 bg-purple-500/10 px-4 py-2 text-xs text-purple-300">
          AURA V0.1
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-120px)] w-full max-w-6xl items-center gap-14 py-12 lg:grid-cols-2">
        <div>
          <p className="mb-5 text-xs font-semibold tracking-[0.3em] text-purple-400">
            PERSONAL INTELLIGENCE SYSTEM
          </p>

          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            Hola, Diego.
            <span className="mt-3 block bg-gradient-to-r from-purple-400 via-violet-300 to-blue-400 bg-clip-text text-transparent">
              Soy Aura.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-400">
            No estoy aquí para pensar por ti. Estoy aquí para pensar contigo,
            ayudarte a desarrollar tus capacidades y convertir tus ideas en
            resultados reales.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {modes.map((mode) => {
              const selected = selectedMode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedMode(mode.id)}
                  className={`rounded-2xl border p-5 text-left transition duration-200 ${
                    selected
                      ? "border-purple-400/60 bg-purple-500/15 shadow-[0_0_35px_rgba(139,92,246,0.15)]"
                      : "border-white/10 bg-white/[0.03] hover:border-purple-400/30 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="text-2xl text-purple-300">{mode.icon}</span>

                  <h2 className="mt-4 font-semibold">{mode.name}</h2>

                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {mode.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-3 shadow-2xl backdrop-blur-xl">
          <div className="rounded-[24px] border border-purple-400/10 bg-black/50 p-7 sm:p-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs tracking-[0.25em] text-zinc-500">
                  ACTIVE MODE
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  {activeMode?.name}
                </h2>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 text-xl shadow-lg shadow-purple-900/40">
                {activeMode?.icon}
              </div>
            </div>

            <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-zinc-500">Aura</p>

              <p className="mt-3 leading-7 text-zinc-200">
                ¿Qué quieres construir hoy? No necesito que tengas todas las
                respuestas. Empezaremos desde donde estás.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
              <input
                type="text"
                placeholder="Escribe tu primera misión..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
              />
            </div>

            <Button fullWidth>
  Comenzar con Aura →
</Button>

            <p className="mt-5 text-center text-xs text-zinc-600">
              Aura piensa contigo, no en tu lugar.
            </p>
          </div>
        </div>
       </section>
    </main>
  );
}