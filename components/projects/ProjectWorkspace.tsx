"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
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
import { normalizeThemeDNA, resolveMotionSignature, resolveProjectTheme } from "@/core/projectTheme/themeDNA";
import type { ProjectThemeDNA } from "@/core/projectTheme/types";

import CreateProjectForm from "./CreateProjectForm";
import LegacyBrandingStudio from "./BrandingStudio";
import LaunchStudio from "./LaunchStudio";
import ProjectList from "./ProjectList";
import ProjectContinuityCard from "./ProjectContinuityCard";
import FounderProjectImport from "./FounderProjectImport";
import ProjectThemeDemoSelector from "./ProjectThemeDemoSelector";
import environmentStyles from "./ProjectEnvironment.module.css";

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
  onProjectSelected?: (project: IAuraProject | null) => void;
  onContinueWithAura?: (targetMessageId?: string) => void;
  onOpenIntelligence?: () => void;
  environmentThemeDNA?: ProjectThemeDNA;
  onThemePreviewChange?: (theme: ProjectThemeDNA | null) => void;
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
  environmentThemeDNA,
  onThemePreviewChange,
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
    (project: IAuraProject | null) => {
      if (project) projectEngine.setCurrentProject(project);
      setActiveProject(project);
      setShowCreateForm(false);
      onProjectSelected?.(project);

      if (
        project &&
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
    onProjectSelected?.(null);
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

  const savedThemeDNA = normalizeThemeDNA(activeProject?.themeDNA);
  const themeDNA = environmentThemeDNA ?? savedThemeDNA;
  const projectTheme = resolveProjectTheme(themeDNA);
  const motion = resolveMotionSignature(activeProject?.id ?? "vaeora", themeDNA);
  const direction = motion.direction;
  const projectStyle = {
    ...projectTheme.tokens,
    "--project-ambient-x": `${motion.ambientX}%`,
    "--project-ambient-y": `${motion.ambientY}%`,
    "--project-micro-duration": `${motion.microDuration}ms`,
    "--project-normal-duration": `${motion.normalDuration}ms`,
    "--project-context-duration": `${motion.contextDuration}ms`,
    "--project-stagger": `${motion.stagger}ms`,
    "--project-easing": motion.easing,
    "--project-enter-scale": motion.scale,
    "--project-enter-x": `${direction === "left" ? -motion.distance : direction === "right" ? motion.distance : 0}px`,
    "--project-enter-y": `${direction === "up" ? -motion.distance : direction === "down" ? motion.distance : 0}px`,
    "--project-item-x": `${direction === "left" ? -motion.distance / 2 : direction === "right" ? motion.distance / 2 : 0}px`,
    "--project-item-y": `${direction === "up" ? -motion.distance / 2 : direction === "down" ? motion.distance / 2 : 0}px`,
  } as CSSProperties;

  return (
    <section className="space-y-6">
      <FounderProjectImport />
      {(showCreateForm || (projectListReady && !activeProject)) && (
        <CreateProjectForm onProjectCreated={refreshProjects} />
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={startNewProject}
          className="min-h-12 touch-manipulation rounded-2xl border border-[var(--project-border,var(--vaeora-line))] bg-[var(--project-surface,var(--vaeora-surface))] px-4 py-2 text-sm font-medium text-[var(--project-link,var(--vaeora-text))] transition hover:border-[var(--project-border-strong,var(--vaeora-focus))] hover:bg-[var(--project-surface-hover,var(--vaeora-raised))] hover:text-[var(--project-link-hover,var(--vaeora-text))] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus,var(--vaeora-focus))] motion-reduce:transform-none motion-reduce:transition-none"
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
        <div className={`${environmentStyles.environment} ${environmentStyles.arrival}`} data-surface={themeDNA.surfacePersonality} data-project-id={activeProject.id} style={projectStyle}>
          <div className={environmentStyles.identity}>
            <div>
              <p className={environmentStyles.eyebrow}>
                Current mission
              </p>
              <h2
                ref={workspaceHeadingRef}
                tabIndex={-1}
                className={environmentStyles.title}
              >
                {activeProject.name}
              </h2>
              <p className={environmentStyles.goal}>
                {activeProject.goal || "Sin objetivo definido"}
              </p>
            </div>

            <div>
              <span className={environmentStyles.status}>
                {activeProject.status}
              </span>
              {activeProject.creativeStudio && (
                <span className={`${environmentStyles.memoryChip} rounded-full border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em]`}>
                  Creative memory active
                </span>
              )}
            </div>
          </div>

          <ProjectContinuityCard
            projectId={activeProject.id}
            onOpenConversation={onContinueWithAura}
          />

          <div className={`${environmentStyles.actionGrid} ${environmentStyles.actions}`}>
            <button
              type="button"
              onClick={() => onContinueWithAura?.()}
              disabled={!onContinueWithAura}
              className={environmentStyles.action}
            >
              <span className={`${environmentStyles.actionLabel} font-mono text-[9px] uppercase tracking-[0.2em]`}>
                VOZ Y CONTEXTO
              </span>
              <span className={`${environmentStyles.actionTitle} mt-3 block text-base font-medium`}>
                Continuar construyendo con Aura →
              </span>
              <span className={`${environmentStyles.actionDescription} mt-1 block text-sm leading-6`}>
                Habla, revisa las fases y toma la siguiente decisión con un toque.
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenIntelligence}
              disabled={!onOpenIntelligence}
              className={environmentStyles.action}
            >
              <span className={`${environmentStyles.actionLabel} font-mono text-[9px] uppercase tracking-[0.2em]`}>
                METAS Y PROGRESO
              </span>
              <span className={`${environmentStyles.actionTitle} mt-3 block text-base font-medium`}>
                Ver inteligencia personal ↗
              </span>
              <span className={`${environmentStyles.actionDescription} mt-1 block text-sm leading-6`}>
                Objetivos, hábitos, prioridades y progreso en el mismo sistema.
              </span>
            </button>
          </div>

          {studios.length > 0 ? (
          <div className={environmentStyles.studios}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={`${environmentStyles.studiosLabel} text-[10px] uppercase tracking-[0.32em]`}>
                  Studios
                </p>
                <h3 className={`${environmentStyles.studiosTitle} mt-2 text-xl font-light`}>
                  One direction. Every expression.
                </h3>
              </div>
              <p className={`${environmentStyles.studiosDescription} max-w-md text-sm leading-6`}>
                Cada estudio guarda su trabajo dentro del proyecto para que Aura pueda
                mantener contexto entre identidad, web, imágenes y lanzamiento.
              </p>
            </div>

            <div className={environmentStyles.studioGrid}>
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
                  className={environmentStyles.studioCard}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className={`${environmentStyles.studioIndex} grid h-10 w-10 place-items-center rounded-2xl border font-mono text-[10px] tracking-[0.15em] transition`}>
                      {studio.index}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`${environmentStyles.studioAction} inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none`}
                    >
                      Abrir <span className="text-sm">↗</span>
                    </span>
                  </div>
                  <h4 className={`${environmentStyles.studioTitle} mt-5 text-base font-medium`}>
                    {studio.title}
                  </h4>
                  <p className={`${environmentStyles.studioDescription} mt-2 text-sm font-light leading-6`}>
                    {studio.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
          ) : null}
          <ProjectThemeDemoSelector key={activeProject.id} savedTheme={savedThemeDNA} onPreview={(theme) => onThemePreviewChange?.(theme)} />
        </div>
      )}
    </section>
  );
}
