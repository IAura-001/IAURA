import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ProjectBrandSystem from "../ProjectBrandSystem";
import type { IAuraProject } from "@/types/project";

const engine = vi.hoisted(() => ({
  updateProject: vi.fn(),
  resetProjectThemeDNA: vi.fn(),
  didLastPersistenceSucceed: vi.fn(() => true),
}));
const sonic = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock("@/core/project/ProjectEngine", () => ({ projectEngine: engine }));
vi.mock("@/core/sonic/SonicDNA", () => ({ sonicEngine: sonic }));

const project: IAuraProject = {
  id: "project-a", name: "Project A", description: "", goal: "", status: "planning",
  createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z",
  studios: { branding: false, website: false, app: false, marketing: false, documents: false },
};

describe("ProjectBrandSystem", () => {
  it("keeps canonical identity by default and previews without persisting", async () => {
    const user = userEvent.setup();
    const preview = vi.fn();
    render(<ProjectBrandSystem project={project} onClose={vi.fn()} onProjectUpdated={vi.fn()} onPreview={preview} onOpenAsset={vi.fn()} />);
    expect(screen.getByText("VAEORA ORIGINAL")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear identidad" }));
    expect(screen.getByText("Superficie")).toBeInTheDocument();
    expect(screen.getByText("Intensidad")).toBeInTheDocument();
    expect(screen.getByText("Movimiento")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Superficie"), "light");
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ surfaceMode: "light" }));
    expect(engine.updateProject).not.toHaveBeenCalled();
  });

  it("applies once and restoring VAEORA Original removes the custom identity", async () => {
    const user = userEvent.setup();
    const updated = { ...project, themeDNA: { version: 1 as const, primaryColor: "#7764E8", secondaryColor: "#3B82F6", accentColor: "#AAA0FF", surfaceMode: "dark" as const, visualIntensity: "subtle" as const, surfacePersonality: "soft" as const, motionStyle: "calm" as const } };
    engine.updateProject.mockReturnValue(updated);
    engine.resetProjectThemeDNA.mockReturnValue(project);
    render(<ProjectBrandSystem project={project} onClose={vi.fn()} onProjectUpdated={vi.fn()} onPreview={vi.fn()} onOpenAsset={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Crear identidad" }));
    await user.click(screen.getByRole("button", { name: "Aplicar identidad" }));
    expect(engine.updateProject).toHaveBeenCalledTimes(1);
    expect(engine.updateProject).toHaveBeenCalledWith("project-a", expect.objectContaining({ themeDNA: expect.any(Object) }));
    await user.click(screen.getByRole("button", { name: "Crear identidad" }));
    await user.click(screen.getByRole("button", { name: "Restaurar VAEORA Original" }));
    expect(engine.resetProjectThemeDNA).toHaveBeenCalledWith("project-a");
  });

  it("cancels a draft without writing the active project", async () => {
    const user = userEvent.setup();
    render(<ProjectBrandSystem project={project} onClose={vi.fn()} onProjectUpdated={vi.fn()} onPreview={vi.fn()} onOpenAsset={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Crear identidad" }));
    await user.selectOptions(screen.getByLabelText("Movimiento"), "dynamic");
    engine.updateProject.mockClear();
    sonic.play.mockClear();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(engine.updateProject).not.toHaveBeenCalled();
    expect(screen.getByText("VAEORA ORIGINAL")).toBeInTheDocument();
  });

  it.each([
    ["Image Lab", "image"],
    ["Creative Direction", "direction"],
    ["Website Kit", "website"],
    ["Library", "library"],
    ["Brand Foundation", "foundation"],
  ] as const)("opens %s through the existing asset destination without persistence", async (label, area) => {
    const user = userEvent.setup();
    const onOpenAsset = vi.fn();
    engine.updateProject.mockClear();
    sonic.play.mockClear();
    render(<ProjectBrandSystem project={project} onClose={vi.fn()} onProjectUpdated={vi.fn()} onPreview={vi.fn()} onOpenAsset={onOpenAsset} />);
    expect(screen.getByRole("heading", { name: "Brand Assets" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: new RegExp(label, "i") }));
    expect(onOpenAsset).toHaveBeenCalledWith(area);
    expect(engine.updateProject).not.toHaveBeenCalled();
    expect(sonic.play).toHaveBeenCalledTimes(1);
    expect(sonic.play).toHaveBeenCalledWith("navigation", null);
  });

  it("keeps Brand Assets available for a custom Project Identity", () => {
    const customProject = {
      ...project,
      themeDNA: {
        version: 1 as const,
        primaryColor: "#12305A",
        secondaryColor: "#25B8D7",
        accentColor: "#7657D6",
        surfaceMode: "dark" as const,
        visualIntensity: "balanced" as const,
        surfacePersonality: "crisp" as const,
        motionStyle: "precision" as const,
      },
    };
    render(<ProjectBrandSystem project={customProject} onClose={vi.fn()} onProjectUpdated={vi.fn()} onPreview={vi.fn()} onOpenAsset={vi.fn()} />);
    expect(screen.getByText("PROJECT IDENTITY")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Image Lab/i })).toBeInTheDocument();
  });

  it("uses a mobile-safe stacked grid with full touch targets", () => {
    render(<ProjectBrandSystem project={project} onClose={vi.fn()} onProjectUpdated={vi.fn()} onPreview={vi.fn()} onOpenAsset={vi.fn()} />);
    const imageLab = screen.getByRole("button", { name: /Image Lab/i });
    expect(imageLab).toHaveClass("min-h-28");
    expect(imageLab.parentElement).toHaveClass("grid", "sm:grid-cols-2");
  });
});
