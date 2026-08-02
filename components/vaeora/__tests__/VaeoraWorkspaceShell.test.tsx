import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import VaeoraWorkspaceShell from "@/components/vaeora/VaeoraWorkspaceShell";

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

function renderShell() {
  return render(
    <VaeoraWorkspaceShell
      locale="es-419"
      userName="Diego"
      presence={<DraftProbe />}
      projects={<p>Project workspace</p>}
      intelligence={<p>Personal intelligence</p>}
    />
  );
}

describe("VaeoraWorkspaceShell", () => {
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
});
