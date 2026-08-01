"use client";

import { useCallback, useState } from "react";

import type { IAuraProject } from "@/types/project";

import BrandingStudio from "./BrandingStudio";
import CreateProjectForm from "./CreateProjectForm";
import LaunchStudio from "./LaunchStudio";
import ProjectList from "./ProjectList";

export default function ProjectWorkspace() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeProject, setActiveProject] = useState<IAuraProject | null>(null);
  const [currentStudio, setCurrentStudio] = useState<string | null>(null);

  function refreshProjects(): void {
    setRefreshKey((current) => current + 1);
  }

  const handleProjectSelected = useCallback((project: IAuraProject) => {
    setActiveProject(project);
    setCurrentStudio(null);
  }, []);

  const hasProjects = refreshKey > 0 || activeProject !== null;

  if (currentStudio === "branding" && activeProject) {
    return (
      <BrandingStudio
        project={activeProject}
        onClose={() => setCurrentStudio(null)}
      />
    );
  }

  if (currentStudio === "launch" && activeProject) {
    return (
      <LaunchStudio
        project={activeProject}
        onClose={() => setCurrentStudio(null)}
      />
    );
  }

  return (
    <section className="space-y-6">
      {!hasProjects && (
        <CreateProjectForm onProjectCreated={refreshProjects} />
      )}

      {hasProjects && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setActiveProject(null);
              setCurrentStudio(null);
              setRefreshKey(0);
            }}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white transition hover:border-violet-400"
          >
            + Nuevo proyecto
          </button>
        </div>
      )}

      <ProjectList
        refreshKey={refreshKey}
        onProjectSelected={handleProjectSelected}
      />

      {activeProject && (
        <div className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-6 backdrop-blur-sm sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-violet-300">
            Current Mission
          </p>

          <h2 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {activeProject.name}
          </h2>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            {activeProject.goal || "Sin objetivo definido"}
          </p>

          <div className="mt-8 flex items-center gap-4">
            <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300">
              ● {activeProject.status.toUpperCase()}
            </span>
          </div>

          <div className="mt-10 rounded-3xl border border-violet-500/20 bg-violet-500/5 p-6 sm:p-8">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
              Studios
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <button
                type="button"
                onClick={() => setCurrentStudio("branding")}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-violet-400/50 hover:bg-violet-500/10"
              >
                <h3 className="text-lg font-semibold text-white">Branding</h3>

                <p className="mt-2 text-sm text-zinc-400">
                  Diseña la identidad completa.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStudio("launch")}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-violet-400/50 hover:bg-violet-500/10"
              >
                <h3 className="text-lg font-semibold text-white">
                  Launch Studio
                </h3>

                <p className="mt-2 text-sm text-zinc-400">
                  Guarda teasers, captions y piezas de lanzamiento.
                </p>
              </button>

              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-violet-400/50 hover:bg-violet-500/10"
              >
                <h3 className="text-lg font-semibold text-white">Website</h3>

                <p className="mt-2 text-sm text-zinc-400">
                  Construye la presencia web.
                </p>
              </button>

              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-violet-400/50 hover:bg-violet-500/10"
              >
                <h3 className="text-lg font-semibold text-white">App</h3>

                <p className="mt-2 text-sm text-zinc-400">
                  Diseña el producto digital.
                </p>
              </button>

              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-violet-400/50 hover:bg-violet-500/10"
              >
                <h3 className="text-lg font-semibold text-white">Marketing</h3>

                <p className="mt-2 text-sm text-zinc-400">
                  Define campañas y crecimiento.
                </p>
              </button>

              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-violet-400/50 hover:bg-violet-500/10"
              >
                <h3 className="text-lg font-semibold text-white">Documents</h3>

                <p className="mt-2 text-sm text-zinc-400">
                  Organiza documentos del proyecto.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
