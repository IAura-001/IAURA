"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authenticatedIntelligenceRepository } from "@/core/intelligence/AuthenticatedIntelligenceRepository";
import { buildIntelligenceContextProjection, emptyIntelligenceContextProjection, type IntelligenceContextProjection, type IntelligenceContextScope } from "@/core/intelligence/contextProjection";
import { projectEngine } from "@/core/project/ProjectEngine";
import type { IAuraProject } from "@/types/project";

export interface IntelligenceAuraBridgeRequest {
  prompt: string;
  scopeType: "global" | "project";
  projectId: string | null;
}
interface Props { requestedProjectId: string | null; refreshKey?: number; onShapeWithAura: (request: IntelligenceAuraBridgeRequest) => void; }
type Scope = "global" | "project";

const prompts = {
  direction: "Ayúdame a definir la dirección de este ámbito de Inteligencia.",
  priority: "Ayúdame a elegir o cambiar las tres prioridades más importantes de este ámbito de Inteligencia.",
  goal: "Ayúdame a convertir una intención en una meta concreta dentro de este ámbito de Inteligencia.",
  commitment: "Ayúdame a definir o cambiar un compromiso recurrente dentro de este ámbito de Inteligencia.",
};
const readProjects = (): IAuraProject[] => projectEngine.getProjects();
const cadence = (item: IntelligenceContextScope["recurringCommitments"][number]) => item.cadence === "daily" ? "Diario" : item.cadence === "weekly" ? item.cadenceDetail || "Semanal" : item.cadenceDetail || "Personalizado";

function AuraAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="max-w-full rounded-full border border-[var(--project-border)] px-3 py-2 text-center text-[10px] uppercase leading-4 tracking-[0.16em] whitespace-normal text-[var(--project-link)] transition hover:border-[var(--project-border-strong)] hover:text-[var(--project-link-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus)]">{children}</button>;
}
function Empty({ text, action, onAura }: { text: string; action: string; onAura: () => void }) {
  return <div className="flex flex-col items-start gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-light text-[var(--project-text-secondary)]">{text}</p><AuraAction onClick={onAura}>{action}</AuraAction></div>;
}

export default function PersonalIntelligenceCenter({ requestedProjectId, refreshKey = 0, onShapeWithAura }: Props) {
  const [availableProjects, setAvailableProjects] = useState(readProjects);
  const activeProject = useMemo(() => availableProjects.find((item) => item.id === requestedProjectId) ?? null, [availableProjects, requestedProjectId]);
  const [scope, setScope] = useState<Scope>("global");
  const [projection, setProjection] = useState<IntelligenceContextProjection>(() => emptyIntelligenceContextProjection(activeProject));
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => projectEngine.subscribe(() => setAvailableProjects(readProjects())), []);
  const load = useCallback(async () => {
    await Promise.resolve();
    const request = ++requestRef.current;
    setStatus("loading");
    setProjection(emptyIntelligenceContextProjection(activeProject));
    try {
      const records = await authenticatedIntelligenceRepository.loadProjection(activeProject?.id ?? null);
      if (request !== requestRef.current) return;
      setProjection(buildIntelligenceContextProjection(records, activeProject));
      setLoadedScopeKey(activeProject?.id ?? "global");
      setStatus("ready");
    } catch {
      if (request !== requestRef.current) return;
      setProjection(emptyIntelligenceContextProjection(activeProject));
      setLoadedScopeKey(activeProject?.id ?? "global");
      setStatus("error");
    }
  }, [activeProject]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => { window.clearTimeout(timer); requestRef.current += 1; };
  }, [load, refreshKey]);

  const displayedScope: Scope = activeProject ? scope : "global";
  const currentScopeKey = activeProject?.id ?? "global";
  const visibleStatus = loadedScopeKey === currentScopeKey ? status : "loading";
  const visibleProjection = loadedScopeKey === currentScopeKey ? projection : emptyIntelligenceContextProjection(activeProject);
  const selected = displayedScope === "project" && visibleProjection.project ? visibleProjection.project : visibleProjection.global;
  const askAura = (prompt: string) => onShapeWithAura({
    prompt: `${prompt} Ámbito: ${displayedScope === "project" && activeProject ? `proyecto ${activeProject.name}` : "global"}.`,
    scopeType: displayedScope,
    projectId: displayedScope === "project" ? activeProject!.id : null,
  });

  return <div data-intelligence-surface="contextual" className="relative min-w-0 max-w-full rounded-[32px] border border-[var(--project-border,var(--vaeora-line))] bg-[var(--project-surface,var(--vaeora-surface))] px-5 py-7 text-[var(--project-text,var(--vaeora-text))] sm:px-8 sm:py-10 lg:px-12">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_0%,var(--project-highlight,rgba(112,88,220,0.10)),transparent_28%)]" aria-hidden="true" />
    <div className="relative mx-auto max-w-5xl">
      <header className="flex flex-col gap-7 border-b border-[var(--project-border,var(--vaeora-line))] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0"><p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--project-metadata,var(--vaeora-muted))]">Inteligencia</p><h1 className="mt-4 text-3xl font-light tracking-[-0.04em] text-[var(--project-text,var(--vaeora-text))] sm:text-5xl">Lo que importa ahora.</h1><p className="mt-3 text-sm font-light text-[var(--project-text-secondary,var(--vaeora-muted))]">Una visión clara de tu dirección, prioridades, metas y compromisos actuales.</p></div>
        <button type="button" onClick={() => askAura("Ayúdame a dar forma a lo que importa ahora")} className="min-h-12 max-w-full shrink-0 rounded-full bg-[var(--project-action,#c4b5fd)] px-5 text-sm font-medium whitespace-normal text-[var(--project-action-text,#171321)] transition hover:bg-[var(--project-action-hover,#fff)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus,var(--vaeora-focus))]">Dale forma con Aura</button>
      </header>
      <div className="mt-7 flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="inline-flex max-w-full rounded-full border border-[var(--project-border)] bg-[var(--project-surface-elevated)] p-1" role="group" aria-label="Ámbito de Inteligencia">
          <button type="button" aria-pressed={displayedScope === "global"} onClick={() => setScope("global")} className={`rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus)] ${displayedScope === "global" ? "bg-[var(--project-active)] text-[var(--project-text)]" : "text-[var(--project-metadata)]"}`}>Global</button>
          {activeProject && <button type="button" aria-pressed={displayedScope === "project"} onClick={() => setScope("project")} className={`rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus)] ${displayedScope === "project" ? "bg-[var(--project-active)] text-[var(--project-text)]" : "text-[var(--project-metadata)]"}`}>Proyecto</button>}
        </div>
        {displayedScope === "project" && activeProject && <p className="min-w-0 truncate text-xs text-[var(--project-metadata)]">{activeProject.name}</p>}
      </div>
      {visibleStatus === "loading" && <div aria-live="polite" className="mt-12 space-y-8"><p className="sr-only">Cargando Inteligencia</p>{["w-2/3", "w-1/2", "w-3/5"].map((width) => <div key={width} className={`h-5 animate-pulse rounded bg-white/[0.05] ${width}`} />)}</div>}
      {visibleStatus === "error" && <div className="mt-12 flex flex-col items-start gap-4"><p className="text-sm text-[var(--project-text-secondary)]">No se pudo cargar Inteligencia.</p><AuraAction onClick={() => void load()}>Reintentar</AuraAction></div>}
      {visibleStatus === "ready" && <div className="mt-11 divide-y divide-[var(--project-border)]">
        <section className="pb-10" aria-labelledby="intel-direction"><div className="flex min-w-0 flex-wrap items-center justify-between gap-4"><h2 id="intel-direction" className="min-w-0 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--project-metadata)]">Dirección</h2>{selected.direction && <AuraAction onClick={() => askAura(prompts.direction)}>Cambiar con Aura</AuraAction>}</div>{selected.direction ? <p className="mt-7 max-w-4xl [overflow-wrap:anywhere] text-2xl font-light leading-relaxed tracking-[-0.025em] text-[var(--project-text)] sm:text-3xl">{selected.direction.content}</p> : <Empty text="Dale a Aura una dirección desde la cual organizar." action="Definir dirección" onAura={() => askAura(prompts.direction)} />}</section>
        <section className="py-10" aria-labelledby="intel-priorities"><div className="flex min-w-0 flex-wrap items-center justify-between gap-4"><h2 id="intel-priorities" className="min-w-0 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--project-metadata)]">Prioridades actuales</h2>{selected.priorities.length > 0 && <AuraAction onClick={() => askAura(prompts.priority)}>Gestionar con Aura</AuraAction>}</div>{selected.priorities.length ? <ol className="mt-7 min-w-0 space-y-1">{selected.priorities.slice(0, 3).map((priority, index) => <li key={priority.recordId} className="grid min-w-0 grid-cols-[2.6rem_minmax(0,1fr)] items-baseline gap-3 border-b border-[var(--project-border)] py-4 last:border-0"><span className="font-mono text-xs text-[var(--project-metadata)]">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 [overflow-wrap:anywhere] text-xl font-light text-[var(--project-text)] sm:text-2xl">{priority.label}</span></li>)}</ol> : <Empty text="Elige qué merece tu atención ahora." action="Añadir prioridad" onAura={() => askAura(prompts.priority)} />}</section>
        <section className="py-10" aria-labelledby="intel-goals"><div className="flex min-w-0 flex-wrap items-center justify-between gap-4"><h2 id="intel-goals" className="min-w-0 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--project-metadata)]">Metas</h2>{selected.goals.length > 0 && <AuraAction onClick={() => askAura(prompts.goal)}>Gestionar con Aura</AuraAction>}</div>{displayedScope === "project" && visibleProjection.project && <div className="mt-7 min-w-0 border-l border-[var(--project-border-strong)] pl-5"><p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--project-metadata)]">Objetivo principal del proyecto</p><p className="mt-3 [overflow-wrap:anywhere] text-lg font-light leading-7 text-[var(--project-text-secondary)]">{visibleProjection.project.projectGoal || "Sin objetivo principal definido."}</p></div>}<div className={displayedScope === "project" ? "mt-8 min-w-0" : "mt-6 min-w-0"}>{displayedScope === "project" && <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--project-metadata)]">Metas adicionales</p>}{selected.goals.length ? <ul className="min-w-0 space-y-3">{selected.goals.map((goal) => <li key={goal.recordId} className="flex min-w-0 items-start gap-3 text-base font-light text-[var(--project-text-secondary)]"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--project-metadata)]" aria-hidden="true" /><span className="min-w-0 [overflow-wrap:anywhere]">{goal.title}</span></li>)}</ul> : <Empty text="Convierte una intención en un resultado concreto." action="Añadir meta" onAura={() => askAura(prompts.goal)} />}</div></section>
        <section className="pt-10" aria-labelledby="intel-commitments"><div className="flex min-w-0 flex-wrap items-center justify-between gap-4"><h2 id="intel-commitments" className="min-w-0 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--project-metadata)]">Compromisos recurrentes</h2>{selected.recurringCommitments.length > 0 && <AuraAction onClick={() => askAura(prompts.commitment)}>Gestionar con Aura</AuraAction>}</div>{selected.recurringCommitments.length ? <ul className="mt-7 grid min-w-0 gap-x-10 gap-y-5 sm:grid-cols-2">{selected.recurringCommitments.map((item) => <li key={item.recordId} className="min-w-0 border-l border-[var(--project-border)] pl-4"><p className="[overflow-wrap:anywhere] text-base font-light text-[var(--project-text-secondary)]">{item.title}</p><p className="mt-1 [overflow-wrap:anywhere] text-xs text-[var(--project-metadata)]">{cadence(item)}</p></li>)}</ul> : <Empty text="Define qué debe seguir ocurriendo." action="Añadir compromiso" onAura={() => askAura(prompts.commitment)} />}</section>
      </div>}
    </div>
  </div>;
}
