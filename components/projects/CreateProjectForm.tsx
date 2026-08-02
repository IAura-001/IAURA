"use client";

import { useState } from "react";

import { projectEngine } from "@/core/project/ProjectEngine";
import type { ProjectKind } from "@/types/project";

const PROJECT_KINDS: Array<{ id: ProjectKind; label: string }> = [
  { id: "general", label: "General" },
  { id: "personal", label: "Personal" },
  { id: "business", label: "Negocio" },
  { id: "creative", label: "Creativo" },
  { id: "learning", label: "Aprendizaje" },
  { id: "wellbeing", label: "Bienestar" },
];

interface CreateProjectFormProps {
  onProjectCreated?: () => void;
}

export default function CreateProjectForm({
  onProjectCreated,
}: CreateProjectFormProps) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [kind, setKind] = useState<ProjectKind>("general");
  const [error, setError] = useState("");

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    try {
      projectEngine.createProject({
        name,
        goal,
        kind,
      });

      setName("");
      setGoal("");
      setKind("general");
      onProjectCreated?.();
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : "No se pudo crear el proyecto.",
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-white">
          Nuevo proyecto o proceso
        </h2>

        <p className="mt-1 text-sm text-zinc-400">
          Puede ser personal, creativo, profesional o de aprendizaje.
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          Tipo
        </legend>
        <div className="flex flex-wrap gap-2">
          {PROJECT_KINDS.map((option) => {
            const selected = kind === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setKind(option.id)}
                aria-pressed={selected}
                data-state={selected ? "selected" : "ready"}
                className={`min-h-11 touch-manipulation rounded-full border px-3 py-2 text-xs transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 motion-reduce:transform-none motion-reduce:transition-none ${
                  selected
                    ? "border-violet-300/35 bg-violet-500/15 text-violet-100"
                    : "border-white/10 bg-white/[0.025] text-zinc-400 hover:border-violet-300/20"
                }`}
              >
                <span aria-hidden="true" className="mr-1.5">
                  {selected ? "✓" : "○"}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <input
        id="new-project-name"
        aria-label="Nombre del proyecto"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nombre o intención"
        className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-violet-400/60 focus-visible:ring-2 focus-visible:ring-violet-300/30"
      />

      <textarea
        id="new-project-goal"
        aria-label="Objetivo del proyecto"
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        placeholder="¿Qué quieres lograr o cambiar?"
        rows={4}
        className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-violet-400/60 focus-visible:ring-2 focus-visible:ring-violet-300/30"
      />

      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!name.trim()}
        data-state={error ? "error" : "ready"}
        className="min-h-12 w-full touch-manipulation rounded-2xl border border-violet-300/20 bg-violet-600 px-4 py-3 font-medium text-white transition hover:bg-violet-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090f] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none motion-reduce:transition-none"
      >
        Crear proyecto
      </button>
    </form>
  );
}
