import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import VaeoraWorkspaceShell from "@/components/vaeora/VaeoraWorkspaceShell";
import WorkspaceLogoutControl from "@/components/vaeora/WorkspaceLogoutControl";

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

describe("VaeoraWorkspaceShell", () => {
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
    expect(shellCss).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.identityStatus\s*{\s*display: none;/);
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
