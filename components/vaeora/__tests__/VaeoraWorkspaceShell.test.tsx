import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import VaeoraWorkspaceShell from "@/components/vaeora/VaeoraWorkspaceShell";
import WorkspaceLogoutControl from "@/components/vaeora/WorkspaceLogoutControl";
import ProjectThemeDemoSelector from "@/components/projects/ProjectThemeDemoSelector";
import { DEFAULT_PROJECT_THEME_DNA, PROJECT_THEME_PRESETS } from "@/core/projectTheme/themeDNA";
import type { ProjectThemeDNA } from "@/core/projectTheme/types";

function DraftProbe() {
  const [value, setValue] = useState("");

  return (
    <input
      aria-label="Conversation draft"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

function renderShell(initialView?: "presence" | "projects" | "intelligence") {
  return render(
    <VaeoraWorkspaceShell
      locale="es-419"
      userName="Diego"
      initialView={initialView}
      presence={<DraftProbe />}
      projects={<p>Project workspace</p>}
      intelligence={<p>Personal intelligence</p>}
    />
  );
}

function PreviewEnvironmentProbe() {
  const [preview, setPreview] = useState<ProjectThemeDNA | null>(null);
  return (
    <VaeoraWorkspaceShell
      locale="es-419"
      userName="Diego"
      activeProjectId="project-a"
      projectThemeDNA={preview}
      presence={<p>Presence</p>}
      projects={<ProjectThemeDemoSelector savedTheme={DEFAULT_PROJECT_THEME_DNA} onPreview={setPreview} />}
      intelligence={<p>Intelligence</p>}
    />
  );
}

describe("VaeoraWorkspaceShell", () => {
  it("localizes the persistent sound control with the workspace locale", () => {
    const view = render(
      <VaeoraWorkspaceShell locale="en-US" userName="Diego" presence={<p>Presence</p>} projects={<p>Projects</p>} intelligence={<p>Intelligence</p>} />,
    );
    expect(screen.getByRole("button", { name: "Sound on" })).toHaveTextContent("Sound on");
    view.rerender(
      <VaeoraWorkspaceShell locale="fr-FR" userName="Diego" presence={<p>Présence</p>} projects={<p>Projets</p>} intelligence={<p>Intelligence</p>} />,
    );
    expect(screen.getByRole("button", { name: "Son activé" })).toHaveTextContent("Son activé");
  });

  it("scopes living context tokens to the active project and replaces them safely", () => {
    const view = render(
      <VaeoraWorkspaceShell locale="es-419" userName="Diego" activeProjectId="a" projectThemeDNA={PROJECT_THEME_PRESETS.wellness} environmentContext="processing"
        presence={<p>Presence</p>} projects={<p>Projects</p>} intelligence={<p>Intelligence</p>} />,
    );
    const shell = screen.getByRole("main");
    const processingGlow = shell.style.getPropertyValue("--living-glow-multiplier");
    expect(shell).toHaveAttribute("data-environment-context", "processing");
    expect(processingGlow).not.toBe("");
    view.rerender(
      <VaeoraWorkspaceShell locale="es-419" userName="Diego" activeProjectId="b" projectThemeDNA={PROJECT_THEME_PRESETS.cybersecurity} environmentContext="reviewing"
        presence={<p>Presence</p>} projects={<p>Projects</p>} intelligence={<p>Intelligence</p>} />,
    );
    expect(shell).toHaveAttribute("data-environment-context", "reviewing");
    expect(shell.style.getPropertyValue("--living-glow-multiplier")).not.toBe(processingGlow);
    view.rerender(
      <VaeoraWorkspaceShell locale="es-419" userName="Diego" activeProjectId={null} projectThemeDNA={null} environmentContext="completed"
        presence={<p>Presence</p>} projects={<p>Projects</p>} intelligence={<p>Intelligence</p>} />,
    );
    expect(shell).not.toHaveAttribute("data-environment-context");
    expect(document.documentElement.style.getPropertyValue("--living-glow-multiplier")).toBe("");
  });

  it("suppresses living motion for reduced motion and bounds it on mobile", () => {
    const css = readFileSync(resolve(process.cwd(), "components/vaeora/VaeoraWorkspaceShell.module.css"), "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important;/);
    expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*?--living-shift-x[\s\S]*?0\.35/);
  });
  it("offers discreet support navigation in the authenticated shell", () => {
    renderShell();
    expect(screen.getByRole("link", { name: "Support" }))
      .toHaveAttribute("href", "/support");
  });
  it("exposes three accessible, persistent workspace views", () => {
    renderShell();

    const tabs = screen.getAllByRole("tab");
    const presencePanel = document.getElementById(
      "vaeora-panel-presence"
    );
    const projectsPanel = document.getElementById(
      "vaeora-panel-projects"
    );
    const intelligencePanel = document.getElementById(
      "vaeora-panel-intelligence"
    );

    expect(tabs).toHaveLength(3);
    expect(
      screen.getByRole("tab", { name: "Presencia" })
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Presencia" })
    ).toHaveAttribute("data-state", "active");
    expect(
      screen.getByRole("tab", { name: "Proyectos" })
    ).toHaveAttribute("data-state", "inactive");
    expect(presencePanel).not.toHaveAttribute("hidden");
    expect(projectsPanel).toHaveAttribute("hidden");
    expect(intelligencePanel).toHaveAttribute("hidden");
  });

  it("switches views and supports keyboard navigation", async () => {
    const user = userEvent.setup();
    renderShell();

    const projectsTab = screen.getByRole("tab", {
      name: "Proyectos",
    });
    await user.click(projectsTab);

    expect(projectsTab).toHaveAttribute("aria-selected", "true");
    expect(
      document.getElementById("vaeora-panel-projects")
    ).not.toHaveAttribute("hidden");

    await user.keyboard("{ArrowRight}");

    expect(
      screen.getByRole("tab", { name: "Inteligencia" })
    ).toHaveAttribute("aria-selected", "true");
  });

  it("preserves local state while a view is hidden", async () => {
    const user = userEvent.setup();
    renderShell();

    const draft = screen.getByRole("textbox", {
      name: "Conversation draft",
    });
    await user.type(draft, "Build VAEORA");
    await user.click(
      screen.getByRole("tab", { name: "Proyectos" })
    );
    await user.click(
      screen.getByRole("tab", { name: "Presencia" })
    );

    expect(draft).toHaveValue("Build VAEORA");
  });

  it("opens a validated deep-linked workspace view", () => {
    renderShell("projects");

    expect(
      screen.getByRole("tab", { name: "Proyectos" })
    ).toHaveAttribute("aria-selected", "true");
    expect(
      document.getElementById("vaeora-panel-projects")
    ).not.toHaveAttribute("hidden");
  });

  it("accepts a controlled view request from an IAURA action", () => {
    const shell = (
      activeView: "presence" | "projects" | "intelligence",
    ) => (
      <VaeoraWorkspaceShell
        locale="es-419"
        userName="Diego"
        activeView={activeView}
        presence={<DraftProbe />}
        projects={<p>Project workspace</p>}
        intelligence={<p>Personal intelligence</p>}
      />
    );
    const { rerender } = render(shell("presence"));

    rerender(shell("projects"));

    expect(
      screen.getByRole("tab", { name: "Proyectos" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      document.getElementById("vaeora-panel-projects"),
    ).not.toHaveAttribute("hidden");
  });

  it("scopes an active project's resolved Theme DNA to the complete shell", () => {
    render(
      <VaeoraWorkspaceShell
        locale="es-419" userName="Diego" activeProjectId="custom-project"
        projectThemeDNA={PROJECT_THEME_PRESETS.autoSales}
        presence={<p>Presence</p>} projects={<p>Projects</p>} intelligence={<p>Intelligence</p>}
      />,
    );
    const shell = screen.getByRole("main");
    expect(shell).toHaveAttribute("data-project-environment", "custom");
    expect(shell.style.getPropertyValue("--project-primary")).toBe("#F97316");
  });

  it("returns the shell to canonical VAEORA when active project authority is null", () => {
    const shell = (activeProjectId: string | null, projectThemeDNA: ProjectThemeDNA | null) => (
      <VaeoraWorkspaceShell locale="es-419" userName="Diego" activeProjectId={activeProjectId} projectThemeDNA={projectThemeDNA}
        presence={<p>Presence</p>} projects={<p>Projects</p>} intelligence={<p>Intelligence</p>} />
    );
    const { rerender } = render(shell("project-a", PROJECT_THEME_PRESETS.wellness));
    expect(screen.getByRole("main")).toHaveAttribute("data-project-surface", "light");
    rerender(shell(null, PROJECT_THEME_PRESETS.wellness));
    expect(screen.getByRole("main")).toHaveAttribute("data-project-environment", "canonical");
    expect(screen.getByRole("main").style.getPropertyValue("--project-primary")).toBe("");
  });

  it("replaces the full shell tokens during rapid project switching", () => {
    const shell = (id: string, theme: ProjectThemeDNA) => (
      <VaeoraWorkspaceShell locale="es-419" userName="Diego" activeProjectId={id} projectThemeDNA={theme}
        presence={<p>Presence</p>} projects={<p>Projects</p>} intelligence={<p>Intelligence</p>} />
    );
    const { rerender } = render(shell("a", PROJECT_THEME_PRESETS.autoSales));
    rerender(shell("b", PROJECT_THEME_PRESETS.wellness));
    rerender(shell("c", PROJECT_THEME_PRESETS.cybersecurity));
    expect(screen.getByRole("main").style.getPropertyValue("--project-primary")).toBe("#12305A");
    expect(screen.getByRole("main").style.getPropertyValue("--project-primary")).not.toBe("#F97316");
  });

  it("lets the dev preview affect the full shell without persistence and restores canonical scope", async () => {
    const user = userEvent.setup();
    render(<PreviewEnvironmentProbe />);
    await user.click(screen.getByRole("tab", { name: "Proyectos" }));
    await user.click(screen.getByRole("button", { name: "Auto Sales" }));
    expect(screen.getByRole("main").style.getPropertyValue("--project-primary")).toBe("#F97316");
    await user.click(screen.getByRole("button", { name: "VAEORA Original" }));
    expect(screen.getByRole("main")).toHaveAttribute("data-project-environment", "canonical");
  });

  it.each([320, 375, 390, 430])("keeps the complete workspace header intentional at %ipx", (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    renderShell("intelligence");

    expect(screen.getByRole("link", { name: "VAEORA" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Presencia" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Proyectos" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Inteligencia" })).toBeVisible();

    const shellCss = readFileSync(resolve(process.cwd(), "components/vaeora/VaeoraWorkspaceShell.module.css"), "utf8");
    const logoutCss = readFileSync(resolve(process.cwd(), "components/vaeora/WorkspaceLogoutControl.module.css"), "utf8");
    expect(shellCss).not.toContain("overflow-x: clip");
    expect(shellCss).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.identityStatus\s*{\s*display: flex;/);
    expect(shellCss).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.soundToggle\s*{[\s\S]*?border-radius: 999px;/);
    expect(shellCss).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.navigation\s*{[\s\S]*?width: 100%;/);
    expect(shellCss).toMatch(/\.tab\s*{[\s\S]*?min-width: 0;/);
    expect(logoutCss).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.logoutForm\s*{[\s\S]*?max-width: calc\(100vw - 1\.5rem\);/);
    expect(logoutCss).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.logoutControl\s*{[\s\S]*?max-width: 100%;/);
  });

  it.each([320, 375, 390, 430])("keeps the localized logout control separated at %ipx", (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    render(<WorkspaceLogoutControl />);

    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    expect(document.body.textContent).not.toContain("SESIÃ");

    const css = readFileSync(resolve(process.cwd(), "components/vaeora/WorkspaceLogoutControl.module.css"), "utf8");
    expect(css).toMatch(/\.logoutControl\s*{[\s\S]*?min-height: 44px;/);
    expect(css).toMatch(/\.logoutLabel\s*{[\s\S]*?white-space: nowrap;/);
    expect(css).toMatch(/\.exitMark\s*{[\s\S]*?flex: 0 0 1\.45rem;/);
    expect(css).not.toContain("overflow-x: hidden");
  });
});
