"use client";

import ProjectWorkspace from "@/components/projects/ProjectWorkspace";
import type { WorkspaceEntryIntent } from "@/components/vaeora/VaeoraWorkspaceShell";
import type { IAuraProject } from "@/types/project";
import type { CreativeStudioRequest } from "@/types/creative-studio";
import type { SupportedLocale } from "@/core/i18n/languages";

interface WorkspaceProps {
  entryIntent?: WorkspaceEntryIntent;
  preferredLocale?: SupportedLocale;
  initialProject?: IAuraProject | null;
  studioRequest?: CreativeStudioRequest;
  onProjectSelected?: (project: IAuraProject) => void;
  onContinueWithAura?: () => void;
  onOpenIntelligence?: () => void;
}

export default function Workspace({
  entryIntent,
  preferredLocale,
  initialProject,
  studioRequest,
  onProjectSelected,
  onContinueWithAura,
  onOpenIntelligence,
}: WorkspaceProps) {
  return (
    <ProjectWorkspace
      entryIntent={entryIntent}
      preferredLocale={preferredLocale}
      initialProject={initialProject}
      studioRequest={studioRequest}
      onProjectSelected={onProjectSelected}
      onContinueWithAura={onContinueWithAura}
      onOpenIntelligence={onOpenIntelligence}
    />
  );
}
