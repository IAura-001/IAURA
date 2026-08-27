import { render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CreativeStudioArea } from "@/types/creative-studio";
import type { IAuraProject } from "@/types/project";

const projectEngineMock = vi.hoisted(() => ({
  clearCurrentProject: vi.fn(),
  getProject: vi.fn<(projectId: string) => IAuraProject | null>(() => null),
  setCurrentProject: vi.fn(),
}));

vi.mock("@/core/project/ProjectEngine", () => ({
  projectEngine: projectEngineMock,
}));

vi.mock("@/components/projects/CreateProjectForm", () => ({
  default: () => <div>Project creation form</div>,
}));

vi.mock("@/components/projects/ProjectList", () => ({
  default: ({
    onProjectSelected,
  }: {
    onProjectSelected: (project: IAuraProject) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onProjectSelected({
          id: "vaeora-project",
          name: "VAEORA",
          description: "An intelligent creative system.",
          goal: "Build a complete brand world.",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
          status: "building",
          studios: {
            branding: true,
            website: true,
            app: true,
            marketing: true,
            documents: true,
          },
        })
      }
    >
      Select VAEORA project
    </button>
  ),
}));

vi.mock("@/components/creative/CreativeStudio", () => ({
  default: ({
    initialArea,
    onClose,
  }: {
    initialArea: CreativeStudioArea;
    onClose: () => void;
  }) => (
    <section aria-label="Creative Studio">
      <p data-testid="creative-area">{initialArea}</p>
      <button type="button" onClick={onClose}>
        Close Creative Studio
      </button>
    </section>
  ),
}));

vi.mock("@/components/projects/LaunchStudio", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <section aria-label="Launch Studio workspace">
      <button type="button" onClick={onClose}>
        Close Launch Studio
      </button>
    </section>
  ),
}));

vi.mock("@/components/sections/BrandingStudio", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <section aria-label="Brand System workspace">
      <button type="button" onClick={onClose}>
        Close Brand System
      </button>
    </section>
  ),
}));

vi.mock("@/components/projects/BrandingStudio", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <section aria-label="Legacy Branding workspace">
      <button type="button" onClick={onClose}>
        Close Legacy Branding
      </button>
    </section>
  ),
}));

import ProjectWorkspace from "@/components/projects/ProjectWorkspace";

async function selectProject() {
  const user = userEvent.setup();

  await user.click(
    screen.getByRole("button", { name: "Select VAEORA project" }),
  );

  return user;
}

describe("ProjectWorkspace studio routing", () => {
  it("uses semantic roles for every functional secondary card consumer", () => {
    const source = readFileSync(resolve(process.cwd(), "components/projects/ProjectWorkspace.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "components/projects/ProjectEnvironment.module.css"), "utf8");
    expect(source).not.toMatch(/Continuar construyendo[\s\S]{0,180}text-zinc-/);
    expect(source).not.toMatch(/Ver inteligencia personal[\s\S]{0,180}text-zinc-/);
    expect(css).toMatch(/\.actionTitle\s*{\s*color: var\(--project-link\);/);
    expect(css).toMatch(/\.actionDescription\s*{\s*color: var\(--project-text-secondary\);/);
    expect(css).toMatch(/\.memoryChip\s*{[\s\S]*?color: var\(--project-metadata\);/);
    expect(css).toMatch(/\.studioTitle\s*{\s*color: var\(--project-text\);/);
  });
  it("opens Creative Studio from the branding deep-link intent", async () => {
    render(<ProjectWorkspace entryIntent="branding" />);

    await selectProject();

    expect(
      screen.getByRole("region", { name: "Creative Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("creative-area")).toHaveTextContent("direction");
  });

  it("opens a requested studio from an IAURA action", async () => {
    render(
      <ProjectWorkspace
        studioRequest={{ id: 1, area: "website" }}
      />,
    );

    await selectProject();

    expect(
      screen.getByRole("region", { name: "Creative Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("creative-area")).toHaveTextContent("website");
  });

  it.each<
    [
      card: string,
      destination:
        | "creative"
        | "launch"
        | "brand-system"
        | "legacy-branding",
      area?: CreativeStudioArea,
    ]
  >([
    ["Creative Studio", "creative", "direction"],
    ["Brand System", "brand-system"],
    ["Legacy Branding Drafts", "legacy-branding"],
    ["Image Lab", "creative", "image"],
    ["Website Kit", "creative", "website"],
    ["Asset Library", "creative", "library"],
    ["Launch Studio", "launch"],
  ])("opens $card in its intended workspace", async (card, destination, area) => {
    render(<ProjectWorkspace />);
    const user = await selectProject();

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(card, "i"),
      }),
    );

    if (destination === "launch") {
      expect(
        screen.getByRole("region", { name: "Launch Studio workspace" }),
      ).toBeInTheDocument();
      return;
    }

    if (destination === "brand-system") {
      expect(
        screen.getByRole("region", { name: "Brand System workspace" }),
      ).toBeInTheDocument();
      return;
    }

    if (destination === "legacy-branding") {
      expect(
        screen.getByRole("region", { name: "Legacy Branding workspace" }),
      ).toBeInTheDocument();
      return;
    }

    expect(
      screen.getByRole("region", { name: "Creative Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("creative-area")).toHaveTextContent(area ?? "");
  });

  it("restores focus to the remounted studio card after closing", async () => {
    render(<ProjectWorkspace />);
    const user = await selectProject();
    const imageLab = screen.getByRole("button", { name: /Image Lab/i });

    await user.click(imageLab);
    await user.click(
      screen.getByRole("button", { name: "Close Creative Studio" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Image Lab/i }),
      ).toHaveFocus();
    });
  });

  it("synchronizes the latest ProjectEngine snapshot back to Home on close", async () => {
    const latestProject: IAuraProject = {
      id: "vaeora-project",
      name: "VAEORA",
      description: "An intelligent creative system.",
      goal: "Build a complete brand world.",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T01:00:00.000Z",
      status: "building",
      studios: {
        branding: true,
        website: true,
        app: true,
        marketing: true,
        documents: true,
      },
    };
    const onProjectSelected = vi.fn();
    projectEngineMock.getProject.mockReturnValueOnce(latestProject);
    render(<ProjectWorkspace onProjectSelected={onProjectSelected} />);
    const user = await selectProject();

    await user.click(
      screen.getByRole("button", { name: /Legacy Branding Drafts/i }),
    );
    await user.click(
      screen.getByRole("button", { name: "Close Legacy Branding" }),
    );

    expect(onProjectSelected).toHaveBeenLastCalledWith(latestProject);
  });
});
