"use client";

import { useEffect, useMemo, useState } from "react";
import { projectEngine } from "@/core/project/ProjectEngine";
import type { IAuraProject } from "@/types/project";

interface PersonalIntelligenceCenterProps {
  requestedProjectId: string | null;
  onResetMemory: () => void;
}

function readAuthenticatedProjects(): IAuraProject[] {
  return projectEngine.getProjects();
}

export default function PersonalIntelligenceCenter({ requestedProjectId, onResetMemory }: PersonalIntelligenceCenterProps) {
  const [projects, setProjects] = useState(readAuthenticatedProjects);

  useEffect(() => projectEngine.subscribe(() => {
    const next = readAuthenticatedProjects();
    setProjects((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }), []);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === requestedProjectId) ?? null,
    [projects, requestedProjectId],
  );
  const latestProject = useMemo(
    () => projects.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null,
    [projects],
  );
  const contextProject = activeProject ?? latestProject;

  return (
    <div className="relative min-w-0 overflow-hidden rounded-[32px] border border-white/[0.07] bg-[#07070c] p-5 sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_4%,rgba(100,79,210,0.13),transparent_34%),radial-gradient(circle_at_10%_78%,rgba(49,82,160,0.08),transparent_31%)]" aria-hidden="true" />
      <div className="relative">
        <header className="max-w-3xl border-b border-white/[0.07] pb-8 sm:pb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-violet-300/65">03 · Inteligencia</p>
          <h2 className="mt-5 text-4xl font-light tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">Tu inteligencia evoluciona contigo.</h2>
          <p className="mt-5 max-w-2xl text-base font-light leading-8 text-zinc-400 sm:text-lg">Aura conecta contexto, proyectos y decisiones para ayudarte a avanzar con mayor claridad.</p>
        </header>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <section className="rounded-[26px] border border-violet-300/15 bg-violet-400/[0.045] p-5 sm:p-7">
            <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-violet-200/60">01 · Contexto activo</p>
            {contextProject ? <>
              <h3 className="mt-6 text-2xl font-light text-zinc-100 sm:text-3xl">{contextProject.name}</h3>
              <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">{contextProject.goal || "Este proyecto todavía no tiene un objetivo definido."}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-zinc-400">{contextProject.status}</span>
                <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-zinc-400">{contextProject.kind ?? "general"}</span>
              </div>
            </> : <div className="mt-6 max-w-lg">
              <h3 className="text-2xl font-light text-zinc-200">Un espacio listo para tu dirección.</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-500">Cuando crees un proyecto autenticado, Aura podrá representarlo aquí sin recurrir a información local compartida.</p>
            </div>}
          </section>

          <section className="rounded-[26px] border border-white/[0.075] bg-white/[0.018] p-5 sm:p-7">
            <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-blue-200/55">02 · Continuidad</p>
            <h3 className="mt-6 text-2xl font-light text-zinc-100">{projects.length > 0 ? `${projects.length} ${projects.length === 1 ? "proyecto conectado" : "proyectos conectados"}` : "Continuidad en preparación"}</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-500">{projects.length > 0 ? "Tus proyectos autenticados permanecen disponibles entre sesiones y dispositivos. Conversaciones y memoria se integrarán cuando tengan límites de propiedad equivalentes." : "La continuidad personal comenzará con tu primer proyecto. No mostramos historial ni memoria local como si fueran inteligencia autenticada."}</p>
          </section>
        </div>

        <section className="mt-4 rounded-[26px] border border-white/[0.07] bg-black/20 p-5 sm:p-7">
          <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-500">03 · Estado de inteligencia</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[{ label: "Identidad", value: "Sesión activa", tone: "violet" }, { label: "Proyectos", value: projects.length > 0 ? "Sincronizados" : "Listos", tone: "blue" }, { label: "Memoria personal", value: "Local · pendiente", tone: "neutral" }, { label: "Conversaciones", value: "Local · pendiente", tone: "neutral" }].map((item) => (
              <div key={item.label} className="rounded-[20px] border border-white/[0.065] bg-white/[0.018] p-4">
                <div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${item.tone === "violet" ? "bg-violet-300" : item.tone === "blue" ? "bg-blue-300" : "bg-zinc-600"}`} aria-hidden="true" /><span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{item.label}</span></div>
                <p className="mt-3 text-sm text-zinc-300">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <details className="mt-4 rounded-[22px] border border-white/[0.055] bg-white/[0.012] p-4 text-zinc-500 open:bg-white/[0.02] sm:p-5">
          <summary className="cursor-pointer select-none text-xs uppercase tracking-[0.16em] text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60">04 · Gestión local</summary>
          <div className="mt-5 flex flex-col gap-4 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-xs leading-6 text-zinc-600">La memoria personal todavía vive en este navegador. Esta acción conserva su comportamiento existente y no afecta tus proyectos autenticados.</p>
            <button type="button" onClick={onResetMemory} className="min-h-11 shrink-0 rounded-full border border-red-300/15 bg-red-400/[0.035] px-4 py-2 text-xs text-red-200/65 transition hover:border-red-300/30 hover:bg-red-400/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200/50">Reiniciar memoria local</button>
          </div>
        </details>
      </div>
    </div>
  );
}
