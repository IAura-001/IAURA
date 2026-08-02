"use client";

import { useEffect, useRef, useState } from "react";

import { projectEngine } from "@/core/project/ProjectEngine";
import { mergeProjectSnapshots } from "@/core/project/mergeProjectSnapshots";
import type { IAuraProject } from "@/types/project";

interface ProjectListProps {
  refreshKey: number;
  onProjectSelected: (project: IAuraProject) => void;
  fallbackProject?: IAuraProject | null;
  onReady?: () => void;
}

function projectSnapshotSignature(project: IAuraProject): string {
  try {
    return JSON.stringify(project);
  } catch {
    return `${project.id}:${project.updatedAt}`;
  }
}

export default function ProjectList({
  refreshKey,
  onProjectSelected,
  fallbackProject,
  onReady,
}: ProjectListProps) {
  const [projects, setProjects] = useState<IAuraProject[]>([]);
  const [activeProjectId, setActiveProjectId] =
    useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const appliedFallbackSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      let currentProject = projectEngine.getCurrentProject();

      const fallbackSignature = fallbackProject
        ? projectSnapshotSignature(fallbackProject)
        : null;

      if (
        fallbackProject &&
        fallbackSignature !== appliedFallbackSignatureRef.current
      ) {
        const storedFallback = projectEngine.getProject(fallbackProject.id);
        const synchronizedFallback = !storedFallback
          ? fallbackProject
          : storedFallback === fallbackProject
            ? storedFallback
            : mergeProjectSnapshots(storedFallback, fallbackProject);

        projectEngine.setCurrentProject(synchronizedFallback);
        appliedFallbackSignatureRef.current = projectSnapshotSignature(
          synchronizedFallback,
        );

        currentProject = synchronizedFallback;
      }

      setProjects(projectEngine.getProjects());
      setActiveProjectId(currentProject?.id ?? null);
      setIsReady(true);
      onReady?.();

      if (currentProject) {
        onProjectSelected(currentProject);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fallbackProject, refreshKey, onProjectSelected, onReady]);

  function handleSelectProject(project: IAuraProject) {
    projectEngine.setCurrentProject(project);
    setActiveProjectId(project.id);
    onProjectSelected(project);
  }

  if (!isReady || projects.length === 0) return null;

  return (
    <div className="space-y-4">
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;

        return (
          <button
            key={project.id}
            type="button"
            aria-pressed={isActive}
            data-state={isActive ? "active" : "inactive"}
            onClick={() => handleSelectProject(project)}
            className={`w-full touch-manipulation rounded-3xl border p-6 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 motion-reduce:transform-none motion-reduce:transition-none ${
              isActive
                ? "border-violet-400/60 bg-violet-500/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/20"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {project.name}
                </h3>

                <p className="mt-2 text-zinc-400">
                  {project.goal || "Sin objetivo"}
                </p>
              </div>

              {isActive && (
                <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-200">
                  Proyecto activo
                </span>
              )}
            </div>

            <div className="mt-4 inline-flex rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-300">
              {(project.kind ?? "general").replace("business", "negocio")} · {project.status}
            </div>
          </button>
        );
      })}
    </div>
  );
}
