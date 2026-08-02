"use client";

import { useEffect, useState } from "react";

import { projectEngine } from "@/core/project/ProjectEngine";
import type { IAuraProject } from "@/types/project";

interface ProjectListProps {
  refreshKey: number;
  onProjectSelected: (project: IAuraProject) => void;
}

export default function ProjectList({
  refreshKey,
  onProjectSelected,
}: ProjectListProps) {
  const [projects, setProjects] = useState<IAuraProject[]>([]);
  const [activeProjectId, setActiveProjectId] =
    useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedProjects = projectEngine.getProjects();
      const currentProject = projectEngine.getCurrentProject();

      setProjects(storedProjects);
      setActiveProjectId(currentProject?.id ?? null);

      if (currentProject) {
        onProjectSelected(currentProject);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshKey, onProjectSelected]);

  function handleSelectProject(project: IAuraProject) {
    projectEngine.setCurrentProject(project);
    setActiveProjectId(project.id);
    onProjectSelected(project);
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-zinc-400">
          Aún no hay proyectos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;

        return (
          <button
            key={project.id}
            type="button"
            onClick={() => handleSelectProject(project)}
            className={`w-full rounded-3xl border p-6 text-left transition ${
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
              {project.status}
            </div>
          </button>
        );
      })}
    </div>
  );
}
