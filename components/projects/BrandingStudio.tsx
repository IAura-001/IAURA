"use client";

import { useEffect, useMemo, useState } from "react";

import {
  generateAIResponse,
  sanitizeAuraResponse,
} from "@/services/ai";
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

        const prompts =
          saved.prompts && typeof saved.prompts === "object"
            ? saved.prompts
            : {};

        const generatedContent =
          saved.generatedContent &&
          typeof saved.generatedContent === "object"
            ? sanitizeContentMap(saved.generatedContent)
            : {};

        setDraft({
          prompts,
          generatedContent,
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
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-zinc-400">
        Cargando Branding Studio...
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-violet-300">
            Branding Studio
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {project.name}
          </h1>

          <p className="mt-4 max-w-2xl text-zinc-400">
            {project.goal || "Construye la identidad completa del proyecto."}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="self-start rounded-xl border border-white/10 px-5 py-3 text-white transition hover:border-violet-400"
        >
          ← Volver
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-2">
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
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                  selectedSection === section.id
                    ? "border-violet-400 bg-violet-500/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20"
                }`}
              >
                <span>{section.label}</span>

                {hasResult && (
                  <span
                    className="h-2 w-2 rounded-full bg-emerald-400"
                    aria-label="Sección generada"
                  />
                )}
              </button>
            );
          })}
        </aside>

        <main className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Área de trabajo
            </p>

            <h2 className="mt-3 text-3xl font-bold text-white">
              {activeSection.label}
            </h2>

            <p className="mt-3 text-zinc-400">
              {activeSection.description}
            </p>
          </div>

          <textarea
            value={activePrompt}
            onChange={(event) => updatePrompt(event.target.value)}
            placeholder={`Describe lo que necesitas para ${activeSection.label.toLowerCase()}...`}
            className="mt-8 h-48 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-5 text-white outline-none placeholder:text-zinc-600 focus:border-violet-400"
          />

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !activePrompt.trim()}
              className="rounded-2xl bg-violet-600 px-6 py-3 font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Generando..." : "Generar con IAURA"}
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              className="rounded-2xl border border-white/10 px-6 py-3 text-white transition hover:border-violet-400"
            >
              Guardar borrador
            </button>
          </div>

          {(feedback || error) && (
            <p
              className={`mt-4 text-sm ${
                error ? "text-red-300" : "text-emerald-300"
              }`}
            >
              {error || feedback}
            </p>
          )}

          {activeResult && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-white">
                  Resultado
                </h3>

                {draft.updatedAt && (
                  <span className="text-xs text-zinc-500">
                    Borrador guardado
                  </span>
                )}
              </div>

              <div className="mt-4 whitespace-pre-wrap text-zinc-300">
                {activeResult}
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
