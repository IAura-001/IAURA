import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import AuraExperienceCard from "@/components/sections/AuraExperienceCard";
import { I18nProvider } from "@/core/i18n/I18nContext";
import type { AuraExperience } from "@/core/actions";

const experience: AuraExperience = {
  kind: "creative",
  title: "Sistema visual para Mita",
  summary: "Aura organizó la creación en tres decisiones claras.",
  phases: [
    { title: "Dirección", description: "Alinear intención y estilo." },
    { title: "Generación", description: "Crear opciones coordinadas." },
    { title: "Selección", description: "Elegir y aprobar lo mejor." },
  ],
  choices: [
    {
      label: "Empezar por el logo",
      description: "Crear el símbolo principal.",
      prompt: "Genera primero un concepto de logo para Mita.",
    },
  ],
  recommendedSurface: "creative-image",
};

function renderCard(
  onChoose = vi.fn(),
  onOpenSurface = vi.fn(),
) {
  render(
    <I18nProvider locale="es-419">
      <AuraExperienceCard
        experience={experience}
        sourceMessageId="assistant-1"
        onChoose={onChoose}
        onOpenSurface={onOpenSurface}
      />
    </I18nProvider>,
  );

  return { onChoose, onOpenSurface };
}

describe("AuraExperienceCard", () => {
  it("shows an adaptive phase route without depending on branding", () => {
    renderCard();

    expect(screen.getByText("Sistema visual para Mita")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Dirección")).toBeInTheDocument();
    expect(screen.getByText("Selección")).toBeInTheDocument();
  });

  it("turns a choice and destination into explicit one-tap actions", async () => {
    const user = userEvent.setup();
    const { onChoose, onOpenSurface } = renderCard();

    const choice = screen.getByRole("button", { name: /Empezar por el logo/ });
    await user.click(choice);

    expect(onChoose).toHaveBeenCalledWith(experience.choices[0], "assistant-1");
    expect(choice).toHaveAttribute("aria-pressed", "true");
    expect(choice).toHaveTextContent("Elegido");

    const open = screen.getByRole("button", { name: /Abrir Image Lab/ });
    await user.click(open);

    expect(onOpenSurface).toHaveBeenCalledWith("creative-image");
    expect(open).toHaveAttribute("aria-pressed", "true");
  });

  it("does nothing with a confirmable choice until the user clicks it", async () => {
    const user = userEvent.setup();
    const confirmable: AuraExperience = {
      ...experience,
      choices: [
        {
          ...experience.choices[0],
          confirmation: {
            kind: "project-decision",
            content: "The primary visual direction uses a monogram.",
          },
        },
      ],
    };
    const onChoose = vi.fn();

    render(
      <I18nProvider locale="es-419">
        <AuraExperienceCard
          experience={confirmable}
          sourceMessageId="assistant-confirmation"
          onChoose={onChoose}
        />
      </I18nProvider>,
    );

    expect(onChoose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Empezar por el logo/ }));
    expect(onChoose).toHaveBeenCalledWith(
      confirmable.choices[0],
      "assistant-confirmation",
    );
  });

  it("does not mark a choice selected when its submission rejects", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn().mockRejectedValue(new Error("confirmation failed"));
    renderCard(onChoose);

    const choice = screen.getByRole("button", { name: /Empezar por el logo/ });
    await user.click(choice);

    expect(onChoose).toHaveBeenCalled();
    expect(choice).toHaveAttribute("aria-pressed", "false");
    expect(choice).not.toHaveTextContent("Elegido");
  });
});
