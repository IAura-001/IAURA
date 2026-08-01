"use client";

import { useState } from "react";

import { projectEngine } from "@/core/project/ProjectEngine";

interface CreateProjectFormProps {
  onProjectCreated?: () => void;
}

export default function CreateProjectForm({
  onProjectCreated,
}: CreateProjectFormProps) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
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
      });

      setName("");
      setGoal("");
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
          Nuevo proyecto
        </h2>

        <p className="mt-1 text-sm text-zinc-400">
          Crea algo y deja que IAURA te acompañe.
        </p>
      </div>

      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nombre del proyecto"
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-violet-400/60"
      />

      <textarea
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        placeholder="¿Qué quieres lograr?"
        rows={4}
        className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-violet-400/60"
      />

      {error && (
        <p className="text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-2xl bg-violet-600 px-4 py-3 font-medium text-white transition hover:bg-violet-500"
      >
        Crear proyecto
      </button>
    </form>
  );
}