import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/core/i18n/I18nContext";
import { Conversation } from "@/components/sections/Conversation";

describe("Conversation windowing controls", () => {
  it("shows the load-older control above the visible messages", async () => {
    const user = userEvent.setup();
    const onLoadOlder = vi.fn();
    render(
      <I18nProvider locale="es-419">
        <Conversation
          messages={[
            { id: "recent-1", role: "user", content: "Recent one" },
            { id: "recent-2", role: "user", content: "Recent two" },
          ]}
          olderMessageCount={20}
          onLoadOlder={onLoadOlder}
        />
      </I18nProvider>,
    );

    const control = screen.getByRole("button", {
      name: "Cargar mensajes anteriores",
    });
    expect(control.compareDocumentPosition(screen.getByText("Recent one")))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(control);
    expect(onLoadOlder).toHaveBeenCalledTimes(1);
  });

  it("hides the control when all messages are visible", () => {
    render(
      <I18nProvider locale="es-419">
        <Conversation
          messages={[{ id: "only", role: "user", content: "Only message" }]}
          olderMessageCount={0}
          onLoadOlder={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.queryByRole("button", {
      name: "Cargar mensajes anteriores",
    })).not.toBeInTheDocument();
  });

  it("renders hydrated assistant content immediately without replaying typing", () => {
    render(
      <I18nProvider locale="es-419">
        <Conversation
          messages={[
            { id: "hydrated-assistant", role: "assistant", content: "Persisted answer" },
          ]}
          animatedMessageIds={new Set()}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("Persisted answer")).toBeVisible();
  });

  it("renders one recommendation card with all four dimensions", () => {
    render(
      <I18nProvider locale="es-419">
        <Conversation messages={[{
          id: "recommendation", role: "assistant", content: "Next step",
          betaNextStep: {
            action: "Build the card",
            whyNow: "The outcome is confirmed",
            result: "One action is visible",
            doneWhen: "The card survives reload",
          },
        }]} />
      </I18nProvider>,
    );

    const card = screen.getByRole("region", { name: "Siguiente paso recomendado" });
    expect(card).toHaveTextContent("Acción");
    expect(card).toHaveTextContent("Build the card");
    expect(card).toHaveTextContent("Por qué ahora");
    expect(card).toHaveTextContent("Resultado esperado");
    expect(card).toHaveTextContent("Terminado cuando");
  });

  it("marks a next step confirmed only after successful submission", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider locale="es-419">
        <Conversation onChoose={onChoose} messages={[{
          id: "source", role: "assistant", content: "Next",
          betaNextStep: { action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible" },
          experience: {
            kind: "decision", title: "Next", summary: "Confirm", phases: [],
            choices: [{ label: "Confirmar siguiente paso", description: "Confirm", prompt: "Continue", confirmation: {
              kind: "beta-next-step", action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible",
            } }], recommendedSurface: "none",
          },
        }]} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Confirmar siguiente paso/ }));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({
      confirmation: expect.objectContaining({ kind: "beta-next-step" }),
    }), "source");
    expect(screen.getByRole("region", { name: "Siguiente paso confirmado" }))
      .toBeVisible();
  });

  it("keeps a rejected next step visibly provisional", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider locale="es-419">
        <Conversation onChoose={vi.fn().mockRejectedValue(new Error("rejected"))} messages={[{
          id: "source", role: "assistant", content: "Next",
          betaNextStep: { action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible" },
          experience: {
            kind: "decision", title: "Next", summary: "Confirm", phases: [],
            choices: [{ label: "Confirmar siguiente paso", description: "Confirm", prompt: "Continue", confirmation: {
              kind: "beta-next-step", action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible",
            } }], recommendedSurface: "none",
          },
        }]} />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Confirmar siguiente paso/ }));
    expect(screen.getByRole("region", { name: "Siguiente paso recomendado" }))
      .toBeVisible();
    expect(screen.queryByRole("region", { name: "Siguiente paso confirmado" }))
      .not.toBeInTheDocument();
  });

  it("renders a hydrated confirmed next step without implying execution", () => {
    render(
      <I18nProvider locale="es-419">
        <Conversation messages={[{
          id: "source", role: "assistant", content: "Next", betaNextStepConfirmed: true,
          betaNextStep: { action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible" },
        }]} />
      </I18nProvider>,
    );
    const card = screen.getByRole("region", { name: "Siguiente paso confirmado" });
    expect(card).toHaveTextContent("todavía no iniciado");
  });

  it.each([
    ["start-now", "Inicio confirmado", "resultado todavía no verificado"],
    ["continue-later", "Guardado para continuar después", "todavía no iniciado"],
  ] as const)("renders hydrated session decision %s truthfully", (decision, title, detail) => {
    render(
      <I18nProvider locale="es-419">
        <Conversation messages={[{
          id: "source", role: "assistant", content: "Next", betaNextStepConfirmed: true,
          betaSessionDecision: decision,
          betaNextStep: { action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible" },
        }]} />
      </I18nProvider>,
    );
    const card = screen.getByRole("region", { name: "Siguiente paso confirmado" });
    expect(card).toHaveTextContent(title);
    expect(card).toHaveTextContent(detail);
  });
});
