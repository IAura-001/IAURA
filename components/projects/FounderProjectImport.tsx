"use client";

import { useState } from "react";
import { LocalProjectRepository } from "@/core/project/ProjectRepository";

export default function FounderProjectImport() {
  const [status, setStatus] = useState("");
  if (process.env.NODE_ENV === "production") return null;

  async function importProjects() {
    if (!window.confirm("Importar los proyectos locales a la cuenta autenticada actual? Verifica primero que esta sea la cuenta fundadora.")) return;
    setStatus("Importando…");
    try {
      const local = new LocalProjectRepository();
      const projects = local.getProjects();
      const response = await fetch("/api/projects/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projects }) });
      const result = await response.json() as { sourceCount?: number; matchedCount?: number; error?: string; code?: string };
      if (!response.ok) { setStatus(`${result.error ?? "Falló la importación."}${result.code ? ` (${result.code})` : ""}`); return; }
      setStatus(`${result.matchedCount}/${result.sourceCount} proyectos verificados. Datos locales conservados. Recarga para verlos.`);
    } catch {
      setStatus("La importación no pudo llegar al servidor local. Revisa la consola y vuelve a intentar.");
    }
  }

  return <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-xs text-zinc-400">
    <button type="button" onClick={importProjects} className="rounded-full border border-amber-200/20 px-3 py-2 text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">Importar proyectos locales a esta cuenta</button>
    {status ? <p className="mt-2" role="status">{status}</p> : null}
  </div>;
}
