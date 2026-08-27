"use client";

import ProjectWorkspace from "@/components/projects/ProjectWorkspace";
import type { WorkspaceEntryIntent } from "@/components/vaeora/VaeoraWorkspaceShell";
import type { IAuraProject } from "@/types/project";
import type { CreativeStudioRequest } from "@/types/creative-studio";
import type { SupportedLocale } from "@/core/i18n/languages";
import type { ProjectThemeDNA } from "@/core/projectTheme/types";

interface WorkspaceProps {
  entryIntent?: WorkspaceEntryIntent;
  preferredLocale?: SupportedLocale;
  initialProject?: IAuraProject | null;
  studioRequest?: CreativeStudioRequest;
  onProjectSelected?: (project: IAuraProject | null) => void;
  onContinueWithAura?: (targetMessageId?: string) => void;
  onOpenIntelligence?: () => void;
  environmentThemeDNA?: ProjectThemeDNA;
  onThemePreviewChange?: (theme: ProjectThemeDNA | null) => void;
}

export default function Workspace({
  entryIntent,
  preferredLocale,
  initialProject,
  studioRequest,
  onProjectSelected,
  onContinueWithAura,
  onOpenIntelligence,
  environmentThemeDNA,
  onThemePreviewChange,
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
      environmentThemeDNA={environmentThemeDNA}
      onThemePreviewChange={onThemePreviewChange}
    />
  );
}
