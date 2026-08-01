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

export type BrandPersonality =
  | "futuristic"
  | "human"
  | "premium"
  | "bold"
  | "serene"
  | "playful";

export type BrandTypography = "modern" | "editorial" | "technical";

export type BrandSymbol = "spark" | "orbit" | "monogram" | "portal";

export type BrandIconContainer = "squircle" | "circle" | "none";

export type BrandSymbolWeight = "light" | "regular" | "bold";

export interface BrandLogoSystem {
  symbol: BrandSymbol;
  container: BrandIconContainer;
  weight: BrandSymbolWeight;
}

export interface BrandPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface BrandProfile {
  brandName: string;
  slogan: string;
  mission: string;
  personality: BrandPersonality[];
  typography: BrandTypography;
  palette: BrandPalette;
  logo: BrandLogoSystem;
  updatedAt: string;
}

export interface BrandingStudioMemory {
  prompts: Record<string, string>;
  generatedContent: Record<string, string>;
  updatedAt: string;
}

export type LaunchAssetStatus = "draft" | "approved";

export type LaunchAssetType =
  | "Instagram teaser"
  | "Instagram caption"
  | "Reel script"
  | "Announcement"
  | "Other";

export interface LaunchAsset {
  id: string;
  title: string;
  type: LaunchAssetType;
  status: LaunchAssetStatus;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface LaunchStudioMemory {
  assets: LaunchAsset[];
  updatedAt: string;
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
  branding?: BrandProfile;
  brandingStudio?: BrandingStudioMemory;
  launchStudio?: LaunchStudioMemory;
}
