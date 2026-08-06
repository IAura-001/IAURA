import type { IAuraProject } from "@/types/project";
import type { SupportedLocale } from "@/core/i18n/languages";

export interface Memory {
  id: string;

  userName: string;

  preferredLocale: SupportedLocale;

  hasCompletedOnboarding: boolean;

  goals: string[];

  habits: string[];

  projects: string[];

  activeProject: IAuraProject | null;

  completedMissions: number;
  completedMissionIds: string[];

  streak: number;

  level: number;

  experience: number;

  lastLogin: string;
}
