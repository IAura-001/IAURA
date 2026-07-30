import type { IAuraProject } from "@/types/project";

interface BrandingStudioProps {
  project: IAuraProject;
}

export default function BrandingStudio({
  project,
}: BrandingStudioProps) {
  return (
    <div className="mt-6 rounded-3xl border border-purple-500/30 bg-white/5 p-6 backdrop-blur-xl">
      <h2 className="mb-4 text-2xl font-bold">🎨 Branding Studio</h2>

      <p className="text-white/60">Proyecto</p>
      <h3 className="mb-6 text-xl">{project.name}</h3>

      <div className="space-y-4">
        <div>
          <p className="text-white/50">Brand Name</p>
          <p className="font-semibold">
            {project.name.toUpperCase()}
          </p>
        </div>

        <div>
          <p className="text-white/50">Slogan</p>
          <p>Building the future.</p>
        </div>

        <div>
          <p className="text-white/50">Style</p>
          <p>Minimal • Futuristic • Premium</p>
        </div>

        <div>
          <p className="text-white/50">Colors</p>
          <p>⚫ Black • 🟣 Purple • ⚪ White</p>
        </div>
      </div>
    </div>
  );
}