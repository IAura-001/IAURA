import type { IAuraProject } from "@/types/project";

interface ProjectCardProps {
  project: IAuraProject;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const activeStudios = Object.entries(project.studios)
    .filter(([, enabled]) => enabled)
    .map(([studio]) => studio);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-purple-300">Proyecto activo</p>
          <h2 className="text-2xl font-semibold">{project.name}</h2>
        </div>

        <span className="rounded-full bg-purple-500/20 px-3 py-1 text-sm capitalize text-purple-200">
          {project.status}
        </span>
      </div>

      <p className="mb-2 text-sm text-white/50">Objetivo</p>
      <p className="mb-5 text-white/80">{project.goal}</p>

      <div className="flex flex-wrap gap-2">
        {activeStudios.map((studio) => (
          <span
            key={studio}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm capitalize text-white/70"
          >
            {studio}
          </span>
        ))}
      </div>
    </section>
  );
}