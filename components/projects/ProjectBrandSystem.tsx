"use client";

import { useEffect, useRef, useState } from "react";

import { projectEngine } from "@/core/project/ProjectEngine";
import { DEFAULT_PROJECT_THEME_DNA, normalizeHex, normalizeThemeDNA } from "@/core/projectTheme/themeDNA";
import type { ProjectThemeDNA } from "@/core/projectTheme/types";
import type { IAuraProject } from "@/types/project";
import type { CreativeStudioArea } from "@/types/creative-studio";
import { sonicEngine } from "@/core/sonic/SonicDNA";

interface Props {
  project: IAuraProject;
  onClose: () => void;
  onProjectUpdated: (project: IAuraProject) => void;
  onPreview: (theme: ProjectThemeDNA | null) => void;
  onOpenAsset: (area: CreativeStudioArea | "foundation") => void;
}

const OPTIONS = {
  surfaceMode: ["light", "dark", "adaptive"],
  visualIntensity: ["subtle", "balanced", "bold"],
  motionStyle: ["calm", "fluid", "dynamic", "precision"],
} as const;
const COLOR_LABELS = { primaryColor: "Primario", secondaryColor: "Secundario", accentColor: "Acento" } as const;
const FIELD_LABELS = { surfaceMode: "Superficie", visualIntensity: "Intensidad", motionStyle: "Movimiento" } as const;
const OPTION_LABELS: Record<string, string> = {
  light: "Clara", dark: "Oscura", adaptive: "Adaptativa",
  subtle: "Sutil", balanced: "Equilibrada", bold: "Expresiva",
  calm: "Calma", fluid: "Fluida", dynamic: "Dinámica", precision: "Precisa",
};

export default function ProjectBrandSystem({ project, onClose, onProjectUpdated, onPreview, onOpenAsset }: Props) {
  const saved = project.themeDNA ? normalizeThemeDNA(project.themeDNA) : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectThemeDNA>(saved ?? DEFAULT_PROJECT_THEME_DNA);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const previewRef = useRef(onPreview);

  useEffect(() => {
    previewRef.current = onPreview;
  }, [onPreview]);

  useEffect(() => () => previewRef.current(null), [project.id]);

  function update(next: ProjectThemeDNA) {
    setDraft(next);
    setDirty(true);
    setError("");
    onPreview(next);
  }

  function cancel() {
    sonicEngine.play("cancel", saved);
    setDraft(saved ?? DEFAULT_PROJECT_THEME_DNA);
    setDirty(false);
    setEditing(false);
    onPreview(null);
  }

  function close() {
    if (dirty && !window.confirm("Descartar los cambios de identidad sin aplicar?")) return;
    sonicEngine.play("close", saved);
    onPreview(null);
    onClose();
  }

  function apply() {
    const normalized = normalizeThemeDNA(draft);
    const updated = projectEngine.updateProject(project.id, { themeDNA: normalized });
    if (!projectEngine.didLastPersistenceSucceed()) {
      setError("No se pudo guardar la identidad del proyecto.");
      return;
    }
    setDraft(normalized);
    setDirty(false);
    setEditing(false);
    onPreview(null);
    onProjectUpdated(updated);
    sonicEngine.play("apply", normalized);
  }

  function reset() {
    const updated = projectEngine.resetProjectThemeDNA(project.id);
    if (!projectEngine.didLastPersistenceSucceed()) {
      setError("No se pudo restaurar la identidad VAEORA.");
      return;
    }
    setDraft(DEFAULT_PROJECT_THEME_DNA);
    setDirty(false);
    setEditing(false);
    onPreview(null);
    onProjectUpdated(updated);
    sonicEngine.play("confirm", null);
  }

  const colors = ["primaryColor", "secondaryColor", "accentColor"] as const;
  const assetDestinations: Array<{ area: CreativeStudioArea | "foundation"; title: string; description: string }> = [
    { area: "image", title: "Image Lab", description: "Crea imágenes y conceptos visuales desde la identidad del proyecto." },
    { area: "direction", title: "Creative Direction", description: "Define y evoluciona la dirección y la fundación de marca." },
    { area: "website", title: "Website Kit", description: "Lleva la identidad a una experiencia web coherente." },
    { area: "library", title: "Library", description: "Revisa versiones, recursos aprobados y exports." },
    { area: "foundation", title: "Brand Foundation", description: "Evoluciona personalidad, tipografía, logo y fundamentos de marca." },
  ];

  return (
    <section className="space-y-6 rounded-[2rem] border border-[var(--project-border,var(--vaeora-line))] bg-[var(--project-surface,var(--vaeora-surface))] p-5 text-[var(--project-text,var(--vaeora-text))] sm:p-8" aria-labelledby="project-brand-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--project-metadata,var(--vaeora-muted))]">Project identity · {project.name}</p>
          <h2 id="project-brand-title" className="mt-2 text-3xl font-light">Brand System</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--project-text-secondary,var(--vaeora-muted))]">La identidad visual pertenece a este proyecto. Los cambios se previsualizan en todo el entorno y solo se guardan al aplicar.</p>
        </div>
        <button type="button" onClick={close} className="rounded-full border border-[var(--project-border)] px-4 py-2">Volver</button>
      </header>

      {!editing ? (
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="rounded-3xl border border-[var(--project-border)] bg-[var(--project-surface-elevated)] p-5">
            <p className="font-medium">{saved ? "PROJECT IDENTITY" : "VAEORA ORIGINAL"}</p>
            <p className="mt-1 text-sm text-[var(--project-text-secondary,var(--vaeora-muted))]">{saved ? "Este proyecto usa una identidad visual propia." : "Este proyecto usa la identidad VAEORA original."}</p>
            <div className="mt-3 flex items-center gap-2" aria-label="Paleta activa">
              {(saved ? [saved.primaryColor, saved.secondaryColor, saved.accentColor] : ["#7764E8", "#3B82F6", "#AAA0FF"]).map((color) => <span key={color} className="h-7 w-7 rounded-full border border-[var(--project-border)]" style={{ backgroundColor: color }} />)}
              <span className="ml-2 text-xs text-[var(--project-metadata)]">{saved ? `${OPTION_LABELS[saved.surfaceMode]} · ${OPTION_LABELS[saved.visualIntensity]} · ${OPTION_LABELS[saved.motionStyle]}` : "Identidad original"}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { sonicEngine.play("open", saved); setEditing(true); }} className="rounded-full bg-[var(--project-action)] px-5 py-3 text-sm font-medium text-[var(--project-action-text)]">{saved ? "Editar identidad" : "Crear identidad"}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {colors.map((field) => (
              <label key={field} className="space-y-2 text-sm">
                <span>{COLOR_LABELS[field]}</span>
                <div className="flex gap-2">
                  <input aria-label={`${field} color picker`} type="color" value={draft[field]} onChange={(event) => update({ ...draft, [field]: event.target.value.toUpperCase() })} className="h-12 w-14 rounded-xl" />
                  <input aria-label={`${field} HEX`} value={draft[field]} onChange={(event) => update({ ...draft, [field]: event.target.value })} onBlur={() => update({ ...draft, [field]: normalizeHex(draft[field], saved?.[field] ?? DEFAULT_PROJECT_THEME_DNA[field]) })} className="min-w-0 flex-1 rounded-xl border border-[var(--project-border)] bg-[var(--project-surface-elevated)] px-3" />
                </div>
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2 text-sm"><span>{FIELD_LABELS.surfaceMode}</span><select aria-label="Superficie" value={draft.surfaceMode} onChange={(event) => update({ ...draft, surfaceMode: event.target.value as ProjectThemeDNA["surfaceMode"] })} className="min-h-12 w-full rounded-xl border border-[var(--project-border)] bg-[var(--project-surface-elevated)] px-3">{OPTIONS.surfaceMode.map((option) => <option key={option} value={option}>{OPTION_LABELS[option]}</option>)}</select></label>
            <label className="space-y-2 text-sm"><span>{FIELD_LABELS.visualIntensity}</span><select aria-label="Intensidad" value={draft.visualIntensity} onChange={(event) => update({ ...draft, visualIntensity: event.target.value as ProjectThemeDNA["visualIntensity"] })} className="min-h-12 w-full rounded-xl border border-[var(--project-border)] bg-[var(--project-surface-elevated)] px-3">{OPTIONS.visualIntensity.map((option) => <option key={option} value={option}>{OPTION_LABELS[option]}</option>)}</select></label>
            <label className="space-y-2 text-sm"><span>{FIELD_LABELS.motionStyle}</span><select aria-label="Movimiento" value={draft.motionStyle} onChange={(event) => update({ ...draft, motionStyle: event.target.value as ProjectThemeDNA["motionStyle"] })} className="min-h-12 w-full rounded-xl border border-[var(--project-border)] bg-[var(--project-surface-elevated)] px-3">{OPTIONS.motionStyle.map((option) => <option key={option} value={option}>{OPTION_LABELS[option]}</option>)}</select></label>
          </div>
          {error ? <p role="alert" className="text-sm text-red-500">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={apply} className="rounded-full bg-[var(--project-action)] px-5 py-3 text-[var(--project-action-text)]">Aplicar identidad</button>
            <button type="button" onClick={cancel} className="rounded-full border border-[var(--project-border)] px-5 py-3">Cancelar</button>
            <button type="button" onClick={reset} className="rounded-full border border-[var(--project-border)] px-5 py-3 text-[var(--project-text-secondary)]">Restaurar VAEORA Original</button>
          </div>
        </div>
      )}

      <section className="border-t border-[var(--project-border)] pt-6" aria-labelledby="brand-assets-title">
        <div className="max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--project-metadata,var(--vaeora-muted))]">Siguiente capa</p>
          <h3 id="brand-assets-title" className="mt-2 text-xl font-light">Brand Assets</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--project-text-secondary,var(--vaeora-muted))]">Usa la identidad de este proyecto para crear, desarrollar y organizar sus activos visuales.</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {assetDestinations.map((destination) => (
            <button
              key={destination.area}
              type="button"
              onClick={() => {
                sonicEngine.play("navigation", saved);
                onOpenAsset(destination.area);
              }}
              className="min-h-28 touch-manipulation rounded-2xl border border-[var(--project-border)] bg-[var(--project-surface-elevated)] p-4 text-left transition hover:border-[var(--project-border-strong)] hover:bg-[var(--project-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--project-focus)] motion-reduce:transition-none"
            >
              <span className="block text-xs font-medium uppercase tracking-[0.16em] text-[var(--project-link)]">{destination.title}</span>
              <span className="mt-2 block text-sm leading-6 text-[var(--project-text-secondary)]">{destination.description}</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
