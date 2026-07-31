import type { IAuraProject } from "@/types/project";

export interface Memory {
  id: string;

  userName: string;

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
