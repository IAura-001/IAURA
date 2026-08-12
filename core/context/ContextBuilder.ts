import type {
  BrainContext,
  BrainInput,
} from "../brain/types";
import {
  projectRepository,
  type ProjectRepository,
} from "../project/ProjectRepository";
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

function formatCreativeStudio(project: IAuraProject): string {
  const studio = project.creativeStudio;

  if (!studio) return "";

  const approvedAssets = studio.assets
    .filter(
      (asset) =>
        asset.status === "approved" &&
        asset.brandRevisionId === studio.brandRevisionId,
    )
    .slice(0, 8)
    .map(
      (asset) =>
        `${asset.title} (${asset.kind}, ${asset.width}x${asset.height}): ${compactText(
          asset.altText || asset.prompt,
          320,
        )}`,
    );
  const importedBranding = Object.entries(
    studio.legacyImport?.brandingContent ?? {},
  )
    .filter(([, content]) => content.trim().length > 0)
    .slice(0, 8)
    .map(
      ([sectionId, content]) =>
        `${sectionId}: ${compactText(content)}`,
    );
  const outputs = Object.entries(studio.outputs)
    .filter(
      ([, record]) =>
        record?.brandRevisionId === studio.brandRevisionId,
    )
    .slice(0, 3)
    .map(([deliverable, record]) => {
      if (!record) return "";

      let serialized = "";
      try {
        serialized = JSON.stringify(record.data);
      } catch {
        serialized = "Contenido estructurado disponible";
      }

      return `${deliverable}: ${compactText(serialized)}`;
    })
    .filter(Boolean);
  const preservedPreviousCount =
    studio.assets.filter(
      (asset) =>
        asset.status === "approved" &&
        asset.brandRevisionId !== studio.brandRevisionId,
    ).length +
    Object.values(studio.outputs).filter(
      (record) =>
        record && record.brandRevisionId !== studio.brandRevisionId,
    ).length;

  return `VAEORA Creative Studio
Marca: ${compactText(studio.brief.brandName)}
Audiencia: ${compactText(studio.brief.audience)}
Oferta: ${compactText(studio.brief.offer)}
Personalidad: ${compactText(studio.brief.personality)}
Dirección visual: ${compactText(studio.brief.visualDirection)}
Revisión de marca: ${studio.brandRevisionId}
${importedBranding.length > 0 ? `Branding anterior importado\n${importedBranding.join("\n")}` : ""}
${outputs.length > 0 ? `Sistemas generados\n${outputs.join("\n")}` : ""}
${approvedAssets.length > 0 ? `Assets visuales aprobados\n${approvedAssets.join("\n")}` : ""}
${preservedPreviousCount > 0 ? `Referencias de revisiones anteriores preservadas fuera del contexto activo: ${preservedPreviousCount}` : ""}`.trim();
}

function formatDevelopmentContinuity(project: IAuraProject): string {
  const continuity = project.developmentContinuity;
  if (!continuity) return "";

  return `CONTINUIDAD ESTABLECIDA DEL PRODUCTO (v${continuity.version})
Identidad: ${compactText(continuity.identity)}
Base funcional: ${continuity.establishedFoundation.map((item) => compactText(item, 240)).join("; ")}
Arquitectura: ${continuity.architecturalDirection.map((item) => compactText(item, 160)).join(" → ")}
Principio de desarrollo: ${compactText(continuity.developmentPrinciple)}`;
}

export function buildProjectMemoryContext(
  project: IAuraProject | null,
): string {
  if (!project) {
    return "";
  }

  const projectIdentity = `ACTIVE PROJECT INTELLIGENCE — PROJECT-SCOPED

Scope: This section is the authoritative context for the currently active project.
Facts about another named project in global personal context must not be transferred to this project.
The active project's goal, status, implementation, development continuity, and capabilities must come from this project-scoped context.

ESTADO DEL PROYECTO DEL USUARIO
Proyecto activo
Nombre: ${compactText(project.name)}
Descripción: ${compactText(project.description)}
Objetivo: ${compactText(project.goal)}
Tipo: ${project.kind ?? "general"}
Estado: ${project.status}`;

  const context = [
    projectIdentity,
    formatDevelopmentContinuity(project),
    formatBrandProfile(project),
    formatBrandingMemory(project),
    formatCreativeStudio(project),
    formatApprovedLaunchAssets(project),
  ]
    .filter(Boolean)
    .join("\n\n");

  if (context.length <= MAX_CONTEXT_LENGTH) {
    return context;
  }

  return `${context.slice(0, MAX_CONTEXT_LENGTH).trim()}…`;
}

export function buildActiveProjectMemoryContext(
  repository: ProjectRepository = projectRepository,
): string {
  return buildProjectMemoryContext(
    repository.getActiveProject(),
  );
}

export function buildBrainContext(
  input: BrainInput,
): BrainContext {
  const explicitUserContext =
    input.userContext?.trim() ?? "";

  const conversationIdentity = input.conversationIdentity
    ? `ConversaciÃ³n activa
ID: ${compactText(input.conversationIdentity.conversationId, 240)}
Ãmbito: ${
        input.conversationIdentity.projectId
          ? `proyecto ${compactText(input.conversationIdentity.projectId, 240)}`
          : "general"
      }`
    : "";

  const projectContext = buildActiveProjectMemoryContext();

  const combinedContext = [
    explicitUserContext
      ? `Contexto adicional del usuario
${explicitUserContext}`
      : "",
    conversationIdentity,
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
