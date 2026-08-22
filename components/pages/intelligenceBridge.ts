import type { IntelligenceAuraBridgeRequest } from "@/components/sections/PersonalIntelligenceCenter";
import type { AuthenticatedProjectRepository } from "@/core/project/AuthenticatedProjectRepository";

export async function prepareIntelligenceBridgeAuthority(
  request: IntelligenceAuraBridgeRequest,
  repository: Pick<AuthenticatedProjectRepository, "getProject" | "getActiveProject" | "ensureActiveProjectId">,
): Promise<boolean> {
  if (request.scopeType === "global") return request.projectId === null;
  if (!request.projectId || !repository.getProject(request.projectId)) return false;
  const activation = await repository.ensureActiveProjectId(request.projectId);
  return activation.ok && repository.getActiveProject()?.id === request.projectId;
}
