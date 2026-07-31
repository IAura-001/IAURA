import type {
  BrandPalette,
  BrandProfile,
  IAuraProject,
} from "@/types/project";

export interface BrandPalettePreset {
  id: "aura" | "celestial" | "obsidian" | "solar";
  name: string;
  palette: BrandPalette;
}

export const BRAND_PALETTE_PRESETS: readonly BrandPalettePreset[] = [
  {
    id: "aura",
    name: "Aura",
    palette: {
      primary: "#7C3AED",
      secondary: "#2563EB",
      accent: "#D946EF",
      background: "#08050F",
      text: "#F8F7FF",
    },
  },
  {
    id: "celestial",
    name: "Celestial",
    palette: {
      primary: "#0F766E",
      secondary: "#0EA5E9",
      accent: "#A7F3D0",
      background: "#031313",
      text: "#F0FDFA",
    },
  },
  {
    id: "obsidian",
    name: "Obsidian",
    palette: {
      primary: "#27272A",
      secondary: "#52525B",
      accent: "#F59E0B",
      background: "#050505",
      text: "#FAFAFA",
    },
  },
  {
    id: "solar",
    name: "Solar",
    palette: {
      primary: "#C2410C",
      secondary: "#EA580C",
      accent: "#FDE047",
      background: "#170A03",
      text: "#FFF7ED",
    },
  },
] as const;

export function normalizeBrandColor(
  color: string,
  fallback: string
): string {
  const normalized = color.trim().toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(normalized)) {
    return normalized;
  }

  if (/^#[0-9A-F]{3}$/.test(normalized)) {
    return `#${normalized
      .slice(1)
      .split("")
      .map((character) => `${character}${character}`)
      .join("")}`;
  }

  return fallback;
}

export function createBrandProfile(
  project: IAuraProject,
  defaults: {
    slogan: string;
    mission: string;
  }
): BrandProfile {
  return (
    project.branding ?? {
      brandName: project.name,
      slogan: defaults.slogan,
      mission:
        project.description.trim() ||
        defaults.mission,
      personality: [
        "futuristic",
        "human",
        "premium",
      ],
      typography: "modern",
      palette: {
        ...BRAND_PALETTE_PRESETS[0].palette,
      },
      updatedAt: project.updatedAt,
    }
  );
}
