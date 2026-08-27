import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import AuraStartingPoints from "@/components/sections/AuraStartingPoints";
import { I18nProvider } from "@/core/i18n/I18nContext";

describe("AuraStartingPoints", () => {
  it("uses semantic project roles for functional option text", () => {
    render(<I18nProvider locale="es-419"><AuraStartingPoints onSelect={vi.fn()} /></I18nProvider>);
    expect(screen.getByText("Empieza con tu voz.").className).toContain("--project-text");
    const option = screen.getByRole("button", { name: /Meta personal/ });
    expect(option.className).toContain("--project-surface-elevated");
    expect(option.innerHTML).toContain("--project-text-secondary");
  });
  it("offers personal, project, creative and wellbeing entry paths", () => {
    render(
      <I18nProvider locale="es-419">
        <AuraStartingPoints onSelect={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: /Meta personal/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marca o negocio/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Crear algo/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bienestar/ })).toBeInTheDocument();
  });

  it("sends a complete natural-language starter with one tap", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <I18nProvider locale="es-419">
        <AuraStartingPoints onSelect={onSelect} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Meta personal/ }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.stringContaining("meta personal"),
    );
  });
});
