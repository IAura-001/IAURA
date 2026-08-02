"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import BrandSystemStudio from "@/components/sections/BrandingStudio";
import { projectEngine } from "@/core/project/ProjectEngine";
import type { SupportedLocale } from "@/core/i18n/languages";
import type {
  CreativeStudioArea,
  CreativeStudioRequest,
} from "@/types/creative-studio";
import type { BrandProfile, IAuraProject } from "@/types/project";
import type { WorkspaceEntryIntent } from "@/components/vaeora/VaeoraWorkspaceShell";

import CreateProjectForm from "./CreateProjectForm";
import LegacyBrandingStudio from "./BrandingStudio";
import LaunchStudio from "./LaunchStudio";
import ProjectList from "./ProjectList";

const CreativeStudio = dynamic(
  () => import("@/components/creative/CreativeStudio"),
  {
    ssr: false,
    loading: () => (
      <section
        className="grid min-h-[52svh] place-items-center rounded-[28px] border border-violet-300/15 bg-[#050509] p-8 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-violet-200/70">
          Preparando Creative Studio…
        </p>
      </section>
    ),
  },
);

interface ProjectWorkspaceProps {
  entryIntent?: WorkspaceEntryIntent;
  preferredLocale?: SupportedLocale;
  initialProject?: IAuraProject | null;
  studioRequest?: CreativeStudioRequest;
  onProjectSelected?: (project: IAuraProject) => void;
  onContinueWithAura?: () => void;
  onOpenIntelligence?: () => void;
}

type StudioSelection =
  | {
      id: "creative";
      area: CreativeStudioArea;
    }
  | {
      id: "launch";
    }
  | {
      id: "brand-system";
    }
  | {
      id: "legacy-branding";
    }
  | null;

interface StudioDefinition {
  id: string;
  index: string;
  title: string;
  description: string;
  selection: Exclude<StudioSelection, null>;
  featured?: boolean;
}

export default function ProjectWorkspace({
  entryIntent,
  preferredLocale,
  initialProject,
  studioRequest,
  onProjectSelected,
  onContinueWithAura,
  onOpenIntelligence,
}: ProjectWorkspaceProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeProject, setActiveProject] = useState<IAuraProject | null>(null);
  const [currentStudio, setCurrentStudio] = useState<StudioSelection>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projectListReady, setProjectListReady] = useState(false);
  const consumedEntryIntentRef = useRef(false);
  const consumedStudioRequestRef = useRef<number | null>(null);
  const lastStudioTriggerIdRef = useRef<string | null>(null);
  const studioTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const workspaceHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (
      !activeProject ||
      !studioRequest ||
      consumedStudioRequestRef.current === studioRequest.id
    ) {
      return;
    }

    consumedStudioRequestRef.current = studioRequest.id;
    lastStudioTriggerIdRef.current = null;
    setCurrentStudio(
      studioRequest.area === "launch"
        ? { id: "launch" }
        : { id: "creative", area: studioRequest.area },
    );
  }, [activeProject, studioRequest]);

  function refreshProjects(): void {
    setShowCreateForm(false);
    setProjectListReady(false);
    setRefreshKey((current) => current + 1);
  }

  const handleProjectSelected = useCallback(
    (project: IAuraProject) => {
      setActiveProject(project);
      setShowCreateForm(false);
      onProjectSelected?.(project);

      if (
        entryIntent === "branding" &&
        !consumedEntryIntentRef.current
      ) {
        consumedEntryIntentRef.current = true;
        lastStudioTriggerIdRef.current = null;
        setCurrentStudio({ id: "creative", area: "direction" });
      }
    },
    [entryIntent, onProjectSelected],
  );

  const handleStudioProjectUpdated = useCallback(
    (project: IAuraProject) => {
      setActiveProject(project);
      onProjectSelected?.(project);
    },
    [onProjectSelected],
  );

  const handleProjectListReady = useCallback(() => {
    setProjectListReady(true);
  }, []);

  const closeStudio = useCallback(() => {
    const latestProject = activeProject
      ? projectEngine.getProject(activeProject.id)
      : null;

    if (latestProject) {
      setActiveProject(latestProject);
      onProjectSelected?.(latestProject);
    }

    setCurrentStudio(null);
    window.setTimeout(() => {
      const triggerId = lastStudioTriggerIdRef.current;
      const remountedTrigger = triggerId
        ? studioTriggerRefs.current.get(triggerId)
        : null;
      const focusTarget = remountedTrigger?.isConnected
        ? remountedTrigger
        : workspaceHeadingRef.current;

      focusTarget?.focus({ preventScroll: true });
    }, 0);
  }, [activeProject, onProjectSelected]);

  const handleBrandProfileSave = useCallback(
    (branding: BrandProfile) => {
      if (!activeProject) return;

      const currentProject =
        projectEngine.getProject(activeProject.id) ?? activeProject;
      const updatedProject: IAuraProject = {
        ...currentProject,
        branding,
        studios: {
          ...currentProject.studios,
          branding: true,
        },
        updatedAt: branding.updatedAt,
      };

      projectEngine.setCurrentProject(updatedProject);
      handleStudioProjectUpdated(updatedProject);
    },
    [activeProject, handleStudioProjectUpdated],
  );

  function startNewProject(): void {
    projectEngine.clearCurrentProject();
    setActiveProject(null);
    setCurrentStudio(null);
    setShowCreateForm(true);
    setRefreshKey((current) => current + 1);
  }

  if (currentStudio?.id === "creative" && activeProject) {
    return (
      <CreativeStudio
        key={`${activeProject.id}-${currentStudio.area}`}
        project={activeProject}
        preferredLocale={preferredLocale}
        initialArea={currentStudio.area}
        onProjectUpdated={handleStudioProjectUpdated}
        onClose={closeStudio}
      />
    );
  }

  if (currentStudio?.id === "launch" && activeProject) {
    return <LaunchStudio project={activeProject} onClose={closeStudio} />;
  }

  if (currentStudio?.id === "brand-system" && activeProject) {
    return (
      <BrandSystemStudio
        key={activeProject.id}
        project={activeProject}
        onSave={handleBrandProfileSave}
        onClose={closeStudio}
      />
    );
  }

  if (currentStudio?.id === "legacy-branding" && activeProject) {
    return (
      <LegacyBrandingStudio
        key={activeProject.id}
        project={activeProject}
        onClose={closeStudio}
      />
    );
  }

  const allStudios: StudioDefinition[] = activeProject
    ? [
        {
          id: "creative",
          index: "01",
          title: "Creative Studio",
          description:
            "Dirección, identidad, logos conceptuales y sistema completo de marca.",
          featured: true,
          selection: { id: "creative", area: "direction" },
        },
        {
          id: "brand-system",
          index: "02",
          title: "Brand System",
          description:
            "Paleta, tipografía, personalidad y marca configurable del sistema IAURA original.",
          selection: { id: "brand-system" },
        },
        {
          id: "legacy-branding",
          index: "03",
          title: "Legacy Branding Drafts",
          description:
            "Prompts, posicionamiento y contenido de branding previo, preservado y editable.",
          selection: { id: "legacy-branding" },
        },
        {
          id: "image",
          index: "04",
          title: "Image Lab",
          description:
            "Fotografía, hero images, producto, texturas y piezas sociales hasta 4K.",
          selection: { id: "creative", area: "image" },
        },
        {
          id: "website",
          index: "05",
          title: "Website Kit",
          description:
            "SEO, hero, secciones, mensajes y llamadas a la acción estructuradas.",
          selection: { id: "creative", area: "website" },
        },
        {
          id: "library",
          index: "06",
          title: "Asset Library",
          description:
            "Versiones, procedencia, selección, aprobación y descarga de originales.",
          selection: { id: "creative", area: "library" },
        },
        {
          id: "launch",
          index: "07",
          title: "Launch Studio",
          description:
            "Teasers, captions y piezas aprobadas para llevar la marca al mundo.",
          selection: { id: "launch" },
        },
      ]
    : [];
  const isLegacyBrandProject = Boolean(
    activeProject &&
      !activeProject.kind &&
      (activeProject.branding ||
        activeProject.brandingStudio ||
        activeProject.creativeStudio ||
        activeProject.studios.branding),
  );
  const isBrandProject =
    activeProject?.kind === "business" || isLegacyBrandProject;
  const isCreativeProject = activeProject?.kind === "creative";
  const creativeStudioIds = new Set([
    "creative",
    "image",
    "website",
    "library",
  ]);
  const studios = isBrandProject
    ? allStudios
    : isCreativeProject
      ? allStudios.filter((studio) => creativeStudioIds.has(studio.id))
      : [];

  return (
    <section className="space-y-6">
      {(showCreateForm || (projectListReady && !activeProject)) && (
        <CreateProjectForm onProjectCreated={refreshProjects} />
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={startNewProject}
          className="min-h-12 touch-manipulation rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-2 text-sm text-zinc-300 transition hover:border-violet-400/40 hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 motion-reduce:transform-none motion-reduce:transition-none"
        >
          + Nuevo proyecto
        </button>
      </div>

      <ProjectList
        refreshKey={refreshKey}
        onProjectSelected={handleProjectSelected}
        fallbackProject={initialProject}
        onReady={handleProjectListReady}
      />

      {activeProject && !showCreateForm && (
        <div className="overflow-hidden rounded-[32px] border border-violet-400/15 bg-[radial-gradient(circle_at_78%_5%,rgba(91,73,190,0.13),transparent_38%),rgba(255,255,255,0.018)] p-5 backdrop-blur-sm sm:p-8 lg:p-10">
          <div className="grid gap-8 border-b border-white/[0.07] pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-violet-300/65">
                Current mission
              </p>
              <h2
                ref={workspaceHeadingRef}
                tabIndex={-1}
                className="mt-5 text-4xl font-light tracking-[-0.045em] text-white outline-none sm:text-5xl lg:text-6xl"
              >
                {activeProject.name}
              </h2>
              <p className="mt-5 max-w-2xl text-base font-light leading-8 text-zinc-400 sm:text-lg">
                {activeProject.goal || "Sin objetivo definido"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-emerald-300/10 bg-emerald-400/[0.06] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200/70">
                {activeProject.status}
              </span>
              {activeProject.creativeStudio && (
                <span className="rounded-full border border-violet-300/10 bg-violet-400/[0.06] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-violet-200/70">
                  Creative memory active
                </span>
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onContinueWithAura}
              disabled={!onContinueWithAura}
              className="min-h-[116px] touch-manipulation rounded-[22px] border border-violet-300/20 bg-violet-500/[0.08] p-5 text-left transition hover:bg-violet-500/[0.13] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-violet-200/60">
                VOZ Y CONTEXTO
              </span>
              <span className="mt-3 block text-base font-medium text-zinc-100">
                Continuar construyendo con Aura →
              </span>
              <span className="mt-1 block text-sm leading-6 text-zinc-500">
                Habla, revisa las fases y toma la siguiente decisión con un toque.
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenIntelligence}
              disabled={!onOpenIntelligence}
              className="min-h-[116px] touch-manipulation rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-5 text-left transition hover:border-violet-300/20 hover:bg-white/[0.045] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">
                METAS Y PROGRESO
              </span>
              <span className="mt-3 block text-base font-medium text-zinc-100">
                Ver inteligencia personal ↗
              </span>
              <span className="mt-1 block text-sm leading-6 text-zinc-500">
                Objetivos, hábitos, prioridades y progreso en el mismo sistema.
              </span>
            </button>
          </div>

          {studios.length > 0 ? (
          <div className="mt-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-zinc-600">
                  Studios
                </p>
                <h3 className="mt-2 text-xl font-light text-zinc-200">
                  One direction. Every expression.
                </h3>
              </div>
              <p className="max-w-md text-sm leading-6 text-zinc-500">
                Cada estudio guarda su trabajo dentro del proyecto para que Aura pueda
                mantener contexto entre identidad, web, imágenes y lanzamiento.
              </p>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {studios.map((studio) => (
                <button
                  key={studio.id}
                  ref={(element) => {
                    if (element) {
                      studioTriggerRefs.current.set(studio.id, element);
                    } else {
                      studioTriggerRefs.current.delete(studio.id);
                    }
                  }}
                  type="button"
                  data-state="ready"
                  onClick={() => {
                    lastStudioTriggerIdRef.current = studio.id;
                    setCurrentStudio(studio.selection);
                  }}
                  className={`group min-h-[168px] touch-manipulation rounded-[24px] border p-5 text-left transition duration-300 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 motion-reduce:transform-none motion-reduce:transition-none ${
                    studio.featured
                      ? "border-violet-300/20 bg-gradient-to-br from-violet-500/[0.12] via-blue-500/[0.05] to-transparent hover:border-violet-300/38"
                      : "border-white/[0.075] bg-white/[0.018] hover:border-violet-300/25 hover:bg-violet-500/[0.055]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/[0.08] font-mono text-[10px] tracking-[0.15em] text-zinc-500 transition group-hover:border-violet-300/25 group-hover:text-violet-200">
                      {studio.index}
                    </span>
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-200 motion-reduce:transform-none motion-reduce:transition-none"
                    >
                      Abrir <span className="text-sm">↗</span>
                    </span>
                  </div>
                  <h4 className="mt-5 text-base font-medium text-zinc-100">
                    {studio.title}
                  </h4>
                  <p className="mt-2 text-sm font-light leading-6 text-zinc-500">
                    {studio.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
