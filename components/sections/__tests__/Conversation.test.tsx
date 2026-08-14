import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/core/i18n/I18nContext";
import { Conversation } from "@/components/sections/Conversation";

describe("Conversation windowing controls", () => {
  it("positions hydrated history only after two render-ready frames", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(
      <I18nProvider locale="es-419">
        <Conversation
          conversationKey="iaura"
          messages={[{ id: "hydrated", role: "assistant", content: "Recent history" }]}
        />
      </I18nProvider>,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
    act(() => frames.shift()?.(0));
    expect(scrollIntoView).not.toHaveBeenCalled();
    act(() => frames.shift()?.(16));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(scrollIntoView.mock.instances[0]).toBe(
      screen.getByTestId("conversation-window"),
    );

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.restoreAllMocks();
  });

  it("does not force a document jump for an empty conversation", () => {
    const requestAnimationFrame = vi.spyOn(window, "requestAnimationFrame");
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(
      <I18nProvider locale="es-419">
        <Conversation conversationKey="empty" messages={[]} />
      </I18nProvider>,
    );

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.restoreAllMocks();
  });

  it("renders load-older after empty-first persisted hydration", () => {
    const complete = Array.from({ length: 35 }, (_, index) => ({
      id: `persisted-${index + 1}`,
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `Persisted ${index + 1}`,
    }));
    const visibleStartIndex = complete.length - 10;
    const { rerender } = render(
      <I18nProvider locale="es-419">
        <Conversation conversationKey="iaura" messages={[]} />
      </I18nProvider>,
    );

    expect(screen.queryByRole("button", {
      name: "Cargar mensajes anteriores",
    })).not.toBeInTheDocument();

    rerender(
      <I18nProvider locale="es-419">
        <Conversation
          conversationKey="iaura"
          messages={complete.slice(visibleStartIndex)}
          olderMessageCount={visibleStartIndex}
          onLoadOlder={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(complete).toHaveLength(35);
    expect(visibleStartIndex).toBe(25);
    expect(screen.getAllByText(/^Persisted \d+$/)).toHaveLength(10);
    expect(screen.getByRole("button", {
      name: "Cargar mensajes anteriores",
    })).toBeVisible();
  });

  it("offers a return-to-latest action when live content grows while paused", async () => {
    const callbacks: ResizeObserverCallback[] = [];
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const user = userEvent.setup();
    const { container } = render(
      <I18nProvider locale="es-419">
        <Conversation
          conversationKey="iaura"
          messages={[{ id: "live", role: "assistant", content: "Growing answer" }]}
          animatedMessageIds={new Set(["live"])}
        />
      </I18nProvider>,
    );
    const end = screen.getByTestId("conversation-end");
    const conversation = container.querySelector("section")!;
    let conversationHeight = 100;
    vi.spyOn(end, "getBoundingClientRect").mockReturnValue({
      bottom: 2_000,
    } as DOMRect);
    vi.spyOn(conversation, "getBoundingClientRect").mockReturnValue({
      get height() {
        return conversationHeight;
      },
    } as DOMRect);
    scrollIntoView.mockClear();

    act(() => {
      window.dispatchEvent(new Event("scroll"));
      frames.splice(0).forEach((callback) => callback(0));
    });
    act(() => {
      callbacks.forEach((callback) => callback([], {} as ResizeObserver));
    });

    const returnButton = await screen.findByRole("button", {
      name: "Volver al final ↓",
    });
    expect(returnButton.parentElement).toHaveClass("fixed");
    expect(scrollIntoView).not.toHaveBeenCalled();
    conversationHeight = 140;
    act(() => {
      callbacks.forEach((callback) => callback([], {} as ResizeObserver));
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
    await user.click(returnButton);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "end" });
    expect(screen.queryByRole("button", { name: "Volver al final ↓" }))
      .not.toBeInTheDocument();

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    expect(container).toBeTruthy();
  });

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

  it("renders and confirms one provisional execution evaluation truthfully", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn().mockResolvedValue(undefined);
    const evaluation = {
      result: "partial" as const,
      observation: "The card appeared but the click failed",
      doneWhenSatisfied: false,
    };
    render(
      <I18nProvider locale="es-419">
        <Conversation onChoose={onChoose} messages={[{
          id: "evaluation", role: "assistant", content: "Review",
          betaExecutionEvaluation: evaluation,
          experience: {
            kind: "decision", title: "Evidence", summary: "Review", phases: [],
            choices: [
              { label: "Confirmar evaluación", description: "Confirm", prompt: "Continue", confirmation: { kind: "beta-execution-evaluation", ...evaluation } },
              { label: "Corregir", description: "Correct", prompt: "Correct it" },
            ], recommendedSurface: "presence",
          },
        }]} />
      </I18nProvider>,
    );

    const card = screen.getByRole("region", { name: "Evaluación provisional" });
    expect(card).toHaveTextContent("Parcial");
    expect(card).toHaveTextContent("No cumplido");
    await user.click(screen.getByRole("button", { name: /Confirmar evaluación/ }));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({
      confirmation: expect.objectContaining({ kind: "beta-execution-evaluation" }),
    }), "evaluation");
    expect(screen.getByRole("region", { name: "Evaluación verificada" })).toBeVisible();
  });

  it("keeps a rejected execution evaluation provisional", async () => {
    const user = userEvent.setup();
    const evaluation = {
      result: "failed" as const,
      observation: "The test failed",
      doneWhenSatisfied: false,
    };
    render(
      <I18nProvider locale="es-419">
        <Conversation onChoose={vi.fn().mockRejectedValue(new Error("rejected"))} messages={[{
          id: "evaluation", role: "assistant", content: "Review",
          betaExecutionEvaluation: evaluation,
          experience: { kind: "decision", title: "Evidence", summary: "Review", phases: [], choices: [{
            label: "Confirmar evaluación", description: "Confirm", prompt: "Continue",
            confirmation: { kind: "beta-execution-evaluation", ...evaluation },
          }], recommendedSurface: "presence" },
        }]} />
      </I18nProvider>,
    );
    await user.click(screen.getByRole("button", { name: /Confirmar evaluación/ }));
    expect(screen.getByRole("region", { name: "Evaluación provisional" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Evaluación verificada" }))
      .not.toBeInTheDocument();
  });

  it("renders hydrated verified step evidence without closing the session", () => {
    render(
      <I18nProvider locale="es-419">
        <Conversation messages={[{
          id: "verified", role: "assistant", content: "Verified",
          betaExecutionEvaluation: {
            result: "passed", observation: "The card remained visible",
            doneWhenSatisfied: true,
          },
          betaExecutionVerified: true,
        }]} />
      </I18nProvider>,
    );
    const card = screen.getByRole("region", { name: "Evaluación verificada" });
    expect(card).toHaveTextContent("Exitosa");
    expect(card).toHaveTextContent("Cumplido");
    expect(card).not.toHaveTextContent(/sesión cerrada/i);
    expect(screen.queryByRole("button", { name: /Confirmar evaluación/ }))
      .not.toBeInTheDocument();
  });

  it("renders and confirms a provisional session review without closing it", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn().mockResolvedValue(undefined);
    const evaluation = { outcomeSatisfied: true, summary: "The outcome is visible" };
    render(<I18nProvider locale="es-419"><Conversation onChoose={onChoose} messages={[{
      id: "session-review", role: "assistant", content: "Review",
      betaSessionEvaluation: evaluation,
      experience: { kind: "decision", title: "Review", summary: "Review", phases: [], choices: [{
        label: "Confirmar evaluación de sesión", description: "Confirm", prompt: "Continue",
        confirmation: { kind: "beta-session-evaluation", ...evaluation },
      }], recommendedSurface: "presence" },
    }]} /></I18nProvider>);
    expect(screen.getByRole("region", { name: "Revisión de sesión" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Confirmar evaluación de sesión/ }));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({
      confirmation: expect.objectContaining({ kind: "beta-session-evaluation" }),
    }), "session-review");
    expect(screen.getByRole("region", { name: "Evaluación de sesión confirmada" }))
      .toBeVisible();
    expect(screen.queryByRole("region", { name: "Sesión cerrada" })).not.toBeInTheDocument();
  });

  it("renders deterministic read-only closed session state", () => {
    render(<I18nProvider locale="es-419"><Conversation messages={[{
      id: "closed-review", role: "assistant", content: "Closed",
      betaSessionEvaluation: { outcomeSatisfied: true, summary: "Outcome satisfied" },
      betaSessionEvaluationConfirmed: true, betaSessionClosed: true,
    }]} /></I18nProvider>);
    const card = screen.getByRole("region", { name: "Sesión cerrada" });
    expect(card).toHaveTextContent("Objetivo de la sesión satisfecho");
    expect(card).toHaveTextContent("Outcome satisfied");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
