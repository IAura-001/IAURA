import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createBrandProfile,
  normalizeBrandColor,
} from "../brandProfile";
import type { IAuraProject } from "@/types/project";

const project: IAuraProject = {
  id: "project-1",
  name: "IAURA",
  description: "Human-centered intelligence.",
  goal: "Build the future.",
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
  status: "planning",
  studios: {
    branding: true,
    website: true,
    app: true,
    marketing: true,
    documents: true,
  },
};

describe("brand profile", () => {
  it("creates an editable identity from a project", () => {
    const profile = createBrandProfile(project, {
      slogan: "Intelligence that builds with you.",
      mission: "Create something meaningful.",
    });

    expect(profile.brandName).toBe("IAURA");
    expect(profile.mission).toBe(
      "Human-centered intelligence."
    );
    expect(profile.palette.primary).toBe("#7C3AED");
    expect(profile.logo).toEqual({
      symbol: "spark",
      container: "squircle",
      weight: "regular",
    });
  });

  it("migrates a saved identity that predates the logo system", () => {
    const legacyProject = {
      ...project,
      branding: {
        brandName: "IAURA",
        slogan: "Build beyond.",
        mission: "Create useful intelligence.",
        personality: ["futuristic" as const],
        typography: "modern" as const,
        palette: {
          primary: "#111111",
          secondary: "#222222",
          accent: "#333333",
          background: "#000000",
          text: "#FFFFFF",
        },
        updatedAt: "2026-07-31T01:00:00.000Z",
      },
    } as IAuraProject;

    const profile = createBrandProfile(legacyProject, {
      slogan: "Fallback",
      mission: "Fallback",
    });

    expect(profile.logo.symbol).toBe("spark");
    expect(profile.palette.primary).toBe("#111111");
  });

  it("normalizes short and long hexadecimal colors", () => {
    expect(normalizeBrandColor("#abc", "#000000")).toBe(
      "#AABBCC"
    );
    expect(normalizeBrandColor("#12abef", "#000000")).toBe(
      "#12ABEF"
    );
    expect(normalizeBrandColor("invalid", "#123456")).toBe(
      "#123456"
    );
  });
});
