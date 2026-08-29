"use client";

import ProjectWorkspace from "@/components/projects/ProjectWorkspace";
import type { WorkspaceEntryIntent } from "@/components/vaeora/VaeoraWorkspaceShell";
import type { IAuraProject } from "@/types/project";
import type { CreativeStudioRequest } from "@/types/creative-studio";
import type { SupportedLocale } from "@/core/i18n/languages";
import type { ProjectThemeDNA } from "@/core/projectTheme/types";
import type { ProjectEnvironmentContext } from "@/core/projectTheme/environmentContext";

interface WorkspaceProps {
  entryIntent?: WorkspaceEntryIntent;
  preferredLocale?: SupportedLocale;
  initialProject?: IAuraProject | null;
  studioRequest?: CreativeStudioRequest;
  brandSystemRequest?: { id: number; projectId: string };
  onProjectSelected?: (project: IAuraProject | null) => void;
  onContinueWithAura?: (targetMessageId?: string) => void;
  onOpenIntelligence?: () => void;
  environmentThemeDNA?: ProjectThemeDNA;
  onThemePreviewChange?: (theme: ProjectThemeDNA | null) => void;
  onEnvironmentContextPreview?: (context: ProjectEnvironmentContext | null) => void;
}

export default function Workspace({
  entryIntent,
  preferredLocale,
  initialProject,
  studioRequest,
  brandSystemRequest,
  onProjectSelected,
  onContinueWithAura,
  onOpenIntelligence,
  environmentThemeDNA,
  onThemePreviewChange,
  onEnvironmentContextPreview,
}: WorkspaceProps) {
  return (
    <ProjectWorkspace
      entryIntent={entryIntent}
      preferredLocale={preferredLocale}
      initialProject={initialProject}
      studioRequest={studioRequest}
      brandSystemRequest={brandSystemRequest}
      onProjectSelected={onProjectSelected}
      onContinueWithAura={onContinueWithAura}
      onOpenIntelligence={onOpenIntelligence}
      environmentThemeDNA={environmentThemeDNA}
      onThemePreviewChange={onThemePreviewChange}
      onEnvironmentContextPreview={onEnvironmentContextPreview}
    />
  );
}
