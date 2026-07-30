export type StudioType =
  | "branding"
  | "website"
  | "app"
  | "marketing"
  | "documents"
  | "automation"
  | "analytics";

export interface IAuraStudio {
  id: string;
  name: string;
  type: StudioType;
  description: string;
  enabled: boolean;
}