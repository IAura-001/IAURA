"use client";

import { useEffect, useMemo, useState } from "react";

import type { IAuraProject } from "@/types/project";

interface LaunchStudioProps {
  project: IAuraProject;
  onClose: () => void;
}

type LaunchAssetStatus = "draft" | "approved";
type LaunchAssetType =
  | "Instagram teaser"
  | "Instagram caption"
  | "Reel script"
  | "Announcement"
  | "Other";

interface LaunchAsset {
  id: string;
  title: string;
  type: LaunchAssetType;
  status: LaunchAssetStatus;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface LaunchLibrary {
  assets: LaunchAsset[];
  updatedAt: string;
}

const STORAGE_PREFIX = "iaura.launch-studio.v1";

const TEASER_02 = `Las ideas no desaparecen.

Se pierden entre notas,
decisiones
y conversaciones olvidadas.

Tu proyecto necesita memoria.
Dirección.
Una mente propia.

IAURA

Every project needs a mind.`;

function getStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}.${projectId}`;
}

function createId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    "randomUUID" in globalThis.crypto
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `launch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createTeaser02(): LaunchAsset {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: "Teaser 02",
    type: "Instagram teaser",
    status: "draft",
    content: TEASER_02,
    createdAt: now,
    updatedAt: now,
  };
}

function createEmptyAsset(): LaunchAsset {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: "Nueva pieza",
    type: "Instagram caption",
    status: "draft",
    content: "",
    createdAt: now,
    updatedAt: now,
  };
}

function saveLibrary(projectId: string, assets: LaunchAsset[]): void {
  const library: LaunchLibrary = {
    assets,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(
    getStorageKey(projectId),
    JSON.stringify(library),
  );
}

export default function LaunchStudio({
  project,
  onClose,
}: LaunchStudioProps) {
  const [assets, setAssets] = useState<LaunchAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  useEffect(() => {
    setIsLoaded(false);
    setFeedback("");
    setError("");

    try {
      const raw = window.localStorage.getItem(getStorageKey(project.id));

      if (!raw) {
        const teaser02 = createTeaser02();
        const seededAssets = [teaser02];

        setAssets(seededAssets);
        setSelectedAssetId(teaser02.id);
        saveLibrary(project.id, seededAssets);
        return;
      }

      const parsed: unknown = JSON.parse(raw);

      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "assets" in parsed &&
        Array.isArray((parsed as Partial<LaunchLibrary>).assets)
      ) {
        const savedAssets = (parsed as LaunchLibrary).assets;
        setAssets(savedAssets);
        setSelectedAssetId(savedAssets[0]?.id ?? "");
      } else {
        const teaser02 = createTeaser02();
        const seededAssets = [teaser02];

        setAssets(seededAssets);
        setSelectedAssetId(teaser02.id);
        saveLibrary(project.id, seededAssets);
      }
    } catch {
      const teaser02 = createTeaser02();
      setAssets([teaser02]);
      setSelectedAssetId(teaser02.id);
      setError("No se pudo cargar la biblioteca anterior.");
    } finally {
      setIsLoaded(true);
    }
  }, [project.id]);

  function updateSelectedAsset(
    updates: Partial<Omit<LaunchAsset, "id" | "createdAt">>,
  ): void {
    if (!selectedAsset) return;

    setAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.id === selectedAsset.id
          ? {
              ...asset,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : asset,
      ),
    );

    setFeedback("");
    setError("");
  }

  function handleCreateAsset(): void {
    const newAsset = createEmptyAsset();

    setAssets((currentAssets) => [newAsset, ...currentAssets]);
    setSelectedAssetId(newAsset.id);
    setFeedback("");
    setError("");
  }

  function handleSave(): void {
    if (!selectedAsset) return;

    if (!selectedAsset.title.trim()) {
      setError("La pieza necesita un nombre.");
      return;
    }

    try {
      const normalizedAssets = assets.map((asset) => ({
        ...asset,
        title: asset.title.trim(),
        content: asset.content.trim(),
      }));

      saveLibrary(project.id, normalizedAssets);
      setAssets(normalizedAssets);
      setFeedback(`"${selectedAsset.title.trim()}" fue guardado.`);
      setError("");
    } catch (saveError) {
      console.error("IAURA launch library save failed:", saveError);
      setError("No se pudo guardar la pieza.");
      setFeedback("");
    }
  }

  function handleDelete(): void {
    if (!selectedAsset) return;

    const confirmed = window.confirm(
      `¿Eliminar "${selectedAsset.title}" de la biblioteca?`,
    );

    if (!confirmed) return;

    const remainingAssets = assets.filter(
      (asset) => asset.id !== selectedAsset.id,
    );

    setAssets(remainingAssets);
    setSelectedAssetId(remainingAssets[0]?.id ?? "");

    try {
      saveLibrary(project.id, remainingAssets);
      setFeedback("Pieza eliminada.");
      setError("");
    } catch {
      setError("La pieza se eliminó de la pantalla, pero no pudo guardarse.");
      setFeedback("");
    }
  }

  async function handleCopy(): Promise<void> {
    if (!selectedAsset?.content) return;

    try {
      await navigator.clipboard.writeText(selectedAsset.content);
      setFeedback("Contenido copiado.");
      setError("");
    } catch {
      setError("No se pudo copiar el contenido.");
      setFeedback("");
    }
  }

  if (!isLoaded) {
    return (
      <section className="fixed inset-0 z-[100] grid place-items-center bg-[#05030b] text-zinc-400">
        Cargando Launch Studio...
      </section>
    );
  }

  return (
    <section className="fixed inset-0 z-[100] overflow-y-auto bg-[#05030b]">
      <div className="mx-auto min-h-screen w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <header className="sticky top-0 z-20 mb-6 flex flex-col gap-5 rounded-3xl border border-white/10 bg-[#090611]/90 p-5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-violet-300">
              Launch Studio
            </p>

            <h1 className="mt-2 truncate text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {project.name}
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
              Guarda, organiza y aprueba las piezas del lanzamiento.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreateAsset}
              className="rounded-xl bg-violet-600 px-5 py-3 font-medium text-white transition hover:bg-violet-500"
            >
              + Nueva pieza
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-5 py-3 text-white transition hover:border-violet-400"
            >
              ← Volver
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.03] p-3 lg:sticky lg:top-[170px]">
            <div className="px-3 pb-3 pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Biblioteca
              </p>

              <p className="mt-2 text-sm text-zinc-400">
                {assets.length} {assets.length === 1 ? "pieza" : "piezas"}
              </p>
            </div>

            <div className="space-y-2">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                    setFeedback("");
                    setError("");
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    asset.id === selectedAssetId
                      ? "border-violet-400 bg-violet-500/15"
                      : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {asset.title || "Sin título"}
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        {asset.type}
                      </p>
                    </div>

                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        asset.status === "approved"
                          ? "bg-emerald-400"
                          : "bg-amber-300"
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>

            {assets.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
                La biblioteca está vacía.
              </div>
            )}
          </aside>

          <main className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7 lg:p-8">
            {selectedAsset ? (
              <>
                <div className="grid gap-5 border-b border-white/10 pb-7 md:grid-cols-[minmax(0,1fr)_220px_180px]">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Nombre
                    </span>

                    <input
                      value={selectedAsset.title}
                      onChange={(event) =>
                        updateSelectedAsset({ title: event.target.value })
                      }
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-violet-400"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Tipo
                    </span>

                    <select
                      value={selectedAsset.type}
                      onChange={(event) =>
                        updateSelectedAsset({
                          type: event.target.value as LaunchAssetType,
                        })
                      }
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-[#090611] px-4 py-3 text-white outline-none focus:border-violet-400"
                    >
                      <option>Instagram teaser</option>
                      <option>Instagram caption</option>
                      <option>Reel script</option>
                      <option>Announcement</option>
                      <option>Other</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Estado
                    </span>

                    <select
                      value={selectedAsset.status}
                      onChange={(event) =>
                        updateSelectedAsset({
                          status: event.target.value as LaunchAssetStatus,
                        })
                      }
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-[#090611] px-4 py-3 text-white outline-none focus:border-violet-400"
                    >
                      <option value="draft">Borrador</option>
                      <option value="approved">Aprobado</option>
                    </select>
                  </label>
                </div>

                <div className="mt-7">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                        Contenido
                      </p>

                      <h2 className="mt-2 text-2xl font-bold text-white">
                        {selectedAsset.title || "Sin título"}
                      </h2>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!selectedAsset.content}
                        className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white transition hover:border-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Copiar
                      </button>

                      <button
                        type="button"
                        onClick={handleDelete}
                        className="rounded-xl border border-red-400/20 px-4 py-3 text-sm text-red-300 transition hover:border-red-400/50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={selectedAsset.content}
                    onChange={(event) =>
                      updateSelectedAsset({ content: event.target.value })
                    }
                    placeholder="Escribe aquí el contenido de la pieza..."
                    className="mt-5 min-h-[460px] w-full resize-y rounded-3xl border border-white/10 bg-black/20 p-6 text-lg leading-8 text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400"
                  />
                </div>

                <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {(feedback || error) && (
                      <p
                        className={`text-sm ${
                          error ? "text-red-300" : "text-emerald-300"
                        }`}
                      >
                        {error || feedback}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-2xl bg-violet-600 px-7 py-4 font-semibold text-white transition hover:bg-violet-500"
                  >
                    Guardar pieza
                  </button>
                </div>
              </>
            ) : (
              <div className="grid min-h-[620px] place-items-center text-center">
                <div>
                  <p className="text-xl font-semibold text-zinc-300">
                    No hay una pieza seleccionada
                  </p>

                  <button
                    type="button"
                    onClick={handleCreateAsset}
                    className="mt-5 rounded-2xl bg-violet-600 px-6 py-3 font-medium text-white transition hover:bg-violet-500"
                  >
                    Crear primera pieza
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
