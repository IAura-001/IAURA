import type {
  IAuraProject,
  ProjectDevelopmentContinuity,
} from "./types";

export const IAURA_DEVELOPMENT_CONTINUITY: ProjectDevelopmentContinuity = {
  version: 1,
  identity: "IAURA is an AI ecosystem centered on Aura.",
  establishedFoundation: [
    "VAEORA entry and Private Beta access",
    "IAURA Presencia and conversation system",
    "Project creation and active-project context",
    "Memory and context infrastructure",
    "Voice input and spoken Aura responses",
    "Personal Intelligence, goals, and habits",
    "Contextual priorities and progress analysis",
  ],
  architecturalDirection: ["Entry / Homepage", "Workspace", "Project Workspace"],
  developmentPrinciple:
    "Continue and refine the existing architecture instead of restarting IAURA as a blank project.",
};

function isCanonicalLegacyIAura(project: IAuraProject): boolean {
  if (project.name.trim().toLocaleLowerCase() !== "iaura") return false;

  const signal = `${project.description} ${project.goal}`.toLocaleLowerCase();
  const hasAuraIdentity = /\baura\b/.test(signal);
  const hasEcosystemSignal = [
    "ecosystem",
    "ecosistema",
    "intelligence",
    "inteligencia",
    "memory",
    "memoria",
    "context",
    "contexto",
    "voice",
    "voz",
    "workspace",
  ].some((term) => signal.includes(term));

  return hasAuraIdentity && hasEcosystemSignal;
}

export function bootstrapIAuraContinuity(
  project: IAuraProject,
): IAuraProject {
  if (project.developmentContinuity || !isCanonicalLegacyIAura(project)) {
    return project;
  }

  return {
    ...project,
    developmentContinuity: IAURA_DEVELOPMENT_CONTINUITY,
  };
}
