import type {
  BrainContext,
  BrainInput,
} from "../brain/types";
import { projectEngine } from "../project/ProjectEngine";
import type { IAuraProject } from "../project/types";

const MAX_SECTION_LENGTH = 1400;
const MAX_CONTEXT_LENGTH = 9000;

function compactText(
  value: string | undefined,
  maxLength = MAX_SECTION_LENGTH,
): string {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}…`;
}

function formatBrandingMemory(project: IAuraProject): string {
  const sections = Object.entries(
    project.brandingStudio?.generatedContent ?? {},
  )
    .filter(([, content]) => content.trim().length > 0)
    .slice(0, 8)
    .map(([sectionId, content]) => {
      return `${sectionId}: ${compactText(content)}`;
    });

  if (sections.length === 0) {
    return "";
  }

  return `Memoria de Branding Studio
${sections.join("\n")}`;
}

function formatBrandProfile(project: IAuraProject): string {
  const profile = project.branding;

  if (!profile) {
    return "";
  }

  const personality =
    profile.personality.length > 0
      ? profile.personality.join(", ")
      : "No definida";

  return `Perfil de marca
Nombre de marca: ${compactText(profile.brandName)}
Slogan: ${compactText(profile.slogan)}
Misión: ${compactText(profile.mission)}
Personalidad: ${personality}
Tipografía: ${profile.typography}
Paleta principal: ${profile.palette.primary}
Paleta secundaria: ${profile.palette.secondary}
Acento: ${profile.palette.accent}`;
}

function formatApprovedLaunchAssets(
  project: IAuraProject,
): string {
  const approvedAssets =
    project.launchStudio?.assets.filter(
      (asset) => asset.status === "approved",
    ) ?? [];

  if (approvedAssets.length === 0) {
    return "";
  }

  const assets = approvedAssets.slice(0, 8).map((asset) => {
    return `${asset.title} (${asset.type}): ${compactText(
      asset.content,
    )}`;
  });

  return `Piezas de lanzamiento aprobadas
${assets.join("\n")}`;
}

export function buildProjectMemoryContext(
  project: IAuraProject | null,
): string {
  if (!project) {
    return "";
  }

  const projectIdentity = `Proyecto activo
Nombre: ${compactText(project.name)}
Descripción: ${compactText(project.description)}
Objetivo: ${compactText(project.goal)}
Estado: ${project.status}`;

  const context = [
    projectIdentity,
    formatBrandProfile(project),
    formatBrandingMemory(project),
    formatApprovedLaunchAssets(project),
  ]
    .filter(Boolean)
    .join("\n\n");

  if (context.length <= MAX_CONTEXT_LENGTH) {
    return context;
  }

  return `${context.slice(0, MAX_CONTEXT_LENGTH).trim()}…`;
}

export function buildBrainContext(
  input: BrainInput,
): BrainContext {
  const explicitUserContext =
    input.userContext?.trim() ?? "";

  const projectContext = buildProjectMemoryContext(
    projectEngine.getCurrentProject(),
  );

  const combinedContext = [
    explicitUserContext
      ? `Contexto adicional del usuario
${explicitUserContext}`
      : "",
    projectContext,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    message: input.message.trim(),
    userContext:
      combinedContext ||
      "No additional user context available.",
    createdAt: new Date().toISOString(),
  };
}
