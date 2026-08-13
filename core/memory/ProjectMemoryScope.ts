const PROJECT_SCOPE_PREFIX = "project:";

export function isProjectScopeTag(tag: string): boolean {
  return tag.trim().toLocaleLowerCase().startsWith(PROJECT_SCOPE_PREFIX);
}

export function createProjectScopeTag(projectId: string): string | null {
  const normalizedProjectId = projectId.trim();
  return normalizedProjectId
    ? `${PROJECT_SCOPE_PREFIX}${normalizedProjectId}`
    : null;
}

export function removeProjectScopeTags(tags: string[]): string[] {
  return tags.filter((tag) => !isProjectScopeTag(tag));
}

export function getProjectScope(tags: string[]): string | null {
  const tag = tags.find(isProjectScopeTag);
  if (!tag) return null;

  const projectId = tag.trim().slice(PROJECT_SCOPE_PREFIX.length).trim();
  return projectId || null;
}
