"use client";

import { useEffect, useMemo, useState } from "react";

import {
  generateAIResponse,
  sanitizeAuraResponse,
} from "../../services/ai";
import type { IAuraProject } from "@/types/project";

interface BrandingStudioProps {
  project: IAuraProject;
  onClose: () => void;
}

interface BrandingSection {
  id: string;
  label: string;
  description: string;
}

interface BrandingDraft {
  prompts: Record<string, string>;
  generatedContent: Record<string, string>;
  updatedAt: string;
}

const SECTIONS: BrandingSection[] = [
  {
    id: "naming",
    label: "Naming",
    description: "Define nombres memorables y alineados con el proyecto.",
  },
  {
    id: "personality",
    label: "Personalidad",
    description: "Construye el carácter, el tono y la forma de expresarse.",
  },
  {
    id: "mission",
    label: "Misión",
    description: "Explica por qué existe la marca y qué cambio busca crear.",
  },
  {
    id: "vision",
    label: "Visión",
    description: "Describe el futuro que la marca quiere hacer posible.",
  },
  {
    id: "logo",
    label: "Logo",
    description: "Explora conceptos de símbolo, composición y significado.",
  },
  {
    id: "colors",
    label: "Colores",
    description: "Diseña una paleta coherente con la emoción de la marca.",
  },
  {
    id: "typography",
    label: "Tipografía",
    description: "Define el sistema tipográfico y su jerarquía visual.",
  },
  {
    id: "style",
    label: "Estilo visual",
    description: "Establece dirección artística, textura, ritmo y atmósfera.",
  },
];

const STORAGE_PREFIX = "iaura.branding-studio.v1";

function getStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}.${projectId}`;
}

function emptyDraft(): BrandingDraft {
  return {
    prompts: {},
    generatedContent: {},
    updatedAt: "",
  };
}

function sanitizeContentMap(
  content: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(content).map(([sectionId, value]) => [
      sectionId,
      sanitizeAuraResponse(value),
    ]),
  );
}

export default function BrandingStudio({
  project,
  onClose,
}: BrandingStudioProps) {
  const [selectedSection, setSelectedSection] = useState("naming");
  const [draft, setDraft] = useState<BrandingDraft>(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const activeSection = useMemo(
    () =>
      SECTIONS.find((section) => section.id === selectedSection) ??
      SECTIONS[0],
    [selectedSection],
  );

  const activePrompt = draft.prompts[selectedSection] ?? "";
  const activeResult = sanitizeAuraResponse(
    draft.generatedContent[selectedSection] ?? "",
  );

  useEffect(() => {
    setIsLoaded(false);
    setSelectedSection("naming");
    setFeedback("");
    setError("");

    try {
      const raw = window.localStorage.getItem(getStorageKey(project.id));

      if (!raw) {
        setDraft(emptyDraft());
        setIsLoaded(true);
        return;
      }

      const parsed: unknown = JSON.parse(raw);

      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "prompts" in parsed &&
        "generatedContent" in parsed
      ) {
        const saved = parsed as Partial<BrandingDraft>;

        setDraft({
          prompts:
            saved.prompts && typeof saved.prompts === "object"
              ? saved.prompts
              : {},
          generatedContent:
            saved.generatedContent &&
            typeof saved.generatedContent === "object"
              ? sanitizeContentMap(saved.generatedContent)
              : {},
          updatedAt:
            typeof saved.updatedAt === "string" ? saved.updatedAt : "",
        });
      } else {
        setDraft(emptyDraft());
      }
    } catch {
      setDraft(emptyDraft());
      setError("No se pudo cargar el borrador guardado.");
    } finally {
      setIsLoaded(true);
    }
  }, [project.id]);

  function updatePrompt(value: string): void {
    setDraft((current) => ({
      ...current,
      prompts: {
        ...current.prompts,
        [selectedSection]: value,
      },
    }));

    setFeedback("");
    setError("");
  }

  function updateResult(value: string): void {
    setDraft((current) => ({
      ...current,
      generatedContent: {
        ...current.generatedContent,
        [selectedSection]: sanitizeAuraResponse(value),
      },
    }));

    setFeedback("");
    setError("");
  }

  async function handleGenerate(): Promise<void> {
    const prompt = activePrompt.trim();

    if (!prompt || loading) {
      if (!prompt) {
        setError("Escribe una instrucción antes de generar.");
      }
      return;
    }

    setLoading(true);
    setFeedback("");
    setError("");

    try {
      const response = await Promise.resolve(
        generateAIResponse(`
Proyecto: ${project.name}

Descripción:
${project.description}

Objetivo:
${project.goal}

Sección de branding:
${activeSection.label}

Instrucción:
${prompt}

Entrega una propuesta clara, específica y aplicable al proyecto.
No utilices markdown, asteriscos, numerales de encabezado ni símbolos decorativos.
        `.trim()),
      );

      const cleanResponse = sanitizeAuraResponse(response);

      setDraft((current) => ({
        ...current,
        generatedContent: {
          ...current.generatedContent,
          [selectedSection]: cleanResponse,
        },
      }));

      setFeedback("Propuesta generada. Revísala y guarda el borrador.");
    } catch (generationError) {
      console.error("IAURA branding generation failed:", generationError);
      setError("IAURA no pudo generar esta sección.");
    } finally {
      setLoading(false);
    }
  }

  function handleSaveDraft(): void {
    setFeedback("");
    setError("");

    try {
      const savedDraft: BrandingDraft = {
        ...draft,
        generatedContent: sanitizeContentMap(draft.generatedContent),
        updatedAt: new Date().toISOString(),
      };

      window.localStorage.setItem(
        getStorageKey(project.id),
        JSON.stringify(savedDraft),
      );

      setDraft(savedDraft);
      setFeedback("Borrador guardado.");
    } catch (saveError) {
      console.error("IAURA branding save failed:", saveError);
      setError("No se pudo guardar el borrador.");
    }
  }

  if (!isLoaded) {
    return (
      <section className="fixed inset-0 z-[100] grid place-items-center bg-[#05030b] text-zinc-400">
        Cargando Branding Studio...
      </section>
    );
  }

  return (
    <section className="fixed inset-0 z-[100] overflow-y-auto bg-[#05030b]">
      <div className="mx-auto min-h-screen w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <header className="sticky top-0 z-20 mb-6 flex flex-col gap-5 rounded-3xl border border-white/10 bg-[#090611]/90 p-5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-violet-300">
              Branding Studio
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {project.name}
              </h1>

              <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
                {activeSection.label}
              </span>
            </div>

            <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
              {project.goal || "Construye la identidad completa del proyecto."}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="rounded-xl bg-violet-600 px-5 py-3 font-medium text-white transition hover:bg-violet-500"
            >
              Guardar borrador
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

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit space-y-2 rounded-3xl border border-white/10 bg-white/[0.03] p-3 lg:sticky lg:top-[170px]">
            {SECTIONS.map((section) => {
              const hasResult = Boolean(draft.generatedContent[section.id]);

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setSelectedSection(section.id);
                    setFeedback("");
                    setError("");
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                    selectedSection === section.id
                      ? "border-violet-400 bg-violet-500/15 text-white"
                      : "border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="font-medium">{section.label}</span>

                  {hasResult && (
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-emerald-400"
                      aria-label="Sección generada"
                    />
                  )}
                </button>
              );
            })}
          </aside>

          <main className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Área de trabajo
                </p>

                <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
                  {activeSection.label}
                </h2>

                <p className="mt-3 max-w-3xl text-zinc-400">
                  {activeSection.description}
                </p>
              </div>

              {draft.updatedAt && (
                <p className="text-xs text-zinc-500">
                  Último guardado:{" "}
                  {new Date(draft.updatedAt).toLocaleString("es")}
                </p>
              )}
            </div>

            <div className="mt-7 grid gap-6 xl:grid-cols-2">
              <section className="min-w-0 rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                    Instrucción
                  </p>

                  <h3 className="mt-2 text-xl font-semibold text-white">
                    Dile a IAURA qué debe construir
                  </h3>
                </div>

                <textarea
                  value={activePrompt}
                  onChange={(event) => updatePrompt(event.target.value)}
                  placeholder={`Describe lo que necesitas para ${activeSection.label.toLowerCase()}...`}
                  className="mt-5 min-h-[360px] w-full resize-y rounded-2xl border border-white/10 bg-[#07040d] p-5 leading-7 text-white outline-none placeholder:text-zinc-600 focus:border-violet-400"
                />

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading || !activePrompt.trim()}
                  className="mt-5 w-full rounded-2xl bg-violet-600 px-6 py-4 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Generando..." : "Generar con IAURA"}
                </button>
              </section>

              <section className="min-w-0 rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    Resultado
                  </p>

                  <h3 className="mt-2 text-xl font-semibold text-white">
                    Propuesta editable
                  </h3>
                </div>

                {activeResult ? (
                  <textarea
                    value={activeResult}
                    onChange={(event) => updateResult(event.target.value)}
                    className="mt-5 min-h-[420px] w-full resize-y rounded-2xl border border-white/10 bg-[#07040d] p-5 leading-7 text-zinc-200 outline-none focus:border-violet-400"
                  />
                ) : (
                  <div className="mt-5 grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-white/10 bg-[#07040d] p-8 text-center">
                    <div>
                      <p className="text-lg font-medium text-zinc-300">
                        Todavía no hay una propuesta
                      </p>

                      <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                        Escribe una instrucción clara y genera el primer
                        resultado para esta sección.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {(feedback || error) && (
              <p
                className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                  error
                    ? "border-red-400/20 bg-red-500/10 text-red-300"
                    : "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {error || feedback}
              </p>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
