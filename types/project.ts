export type ProjectStatus =
  | "planning"
  | "building"
  | "launching"
  | "completed";

export interface ProjectStudios {
  branding: boolean;
  website: boolean;
  app: boolean;
  marketing: boolean;
  documents: boolean;
}

export interface IAuraProject {
  id: string;
  name: string;
  description: string;
  goal: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  studios: ProjectStudios;
}
