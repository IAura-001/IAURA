import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/core/i18n/I18nContext";
import { Conversation } from "@/components/sections/Conversation";

describe("Conversation windowing controls", () => {
  it("scrolls a requested trusted message instead of historical content", () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(
      <I18nProvider locale="es-419">
        <Conversation
          conversationKey="iaura"
          messages={[
            { id: "historical-recovery", role: "assistant", content: "Old recovery" },
            { id: "current-handoff", role: "assistant", content: "Current handoff" },
          ]}
          navigationTargetMessageId="current-handoff"
          navigationRequestId={1}
        />
      </I18nProvider>,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
    expect(scrollIntoView.mock.instances[0]).toHaveAttribute(
      "data-message-id",
      "current-handoff",
    );
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

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

  it("renders both persisted ready-to-start decisions as actionable choices", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn().mockResolvedValue(undefined);
    const choices = [
      { label: "Empezar ahora", description: "Start", prompt: "Start", confirmation: {
        kind: "beta-session-decision" as const, decision: "start-now" as const,
      } },
      { label: "Continuar después", description: "Later", prompt: "Later", confirmation: {
        kind: "beta-session-decision" as const, decision: "continue-later" as const,
      } },
    ];
    render(
      <I18nProvider locale="es-419">
        <Conversation onChoose={onChoose} messages={[{
          id: "ready", role: "assistant", content: "Choose when to start.",
          experience: {
            kind: "decision", title: "Ready", summary: "Choose", phases: [],
            choices, recommendedSurface: "presence",
          },
        }]} />
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: /Empezar ahora/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Continuar después/ }));
    expect(onChoose).toHaveBeenCalledWith(choices[1], "ready");
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

  it("shows incomplete recovery choices once and renders the hydrated disposition", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const onChoose = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const recoveryMessage = {
      id: "recovery", role: "assistant" as const, content: "Evidence preserved.",
      experience: {
        kind: "decision" as const, title: "Recovery", summary: "Same confirmed step",
        phases: [],
        choices: [
          { label: "Reintentar ahora", description: "Retry", prompt: "Retry", confirmation: { kind: "beta-incomplete-execution-recovery" as const, decision: "retry-now" as const } },
          { label: "Continuar después", description: "Later", prompt: "Later", confirmation: { kind: "beta-incomplete-execution-recovery" as const, decision: "retry-later" as const } },
        ], recommendedSurface: "presence" as const,
      },
    };
    const { rerender } = render(
      <I18nProvider locale="es-419">
        <Conversation onChoose={onChoose} messages={[recoveryMessage]} />
      </I18nProvider>,
    );
    const retry = screen.getByRole("button", { name: /Reintentar ahora/ });
    await user.click(retry);
    await user.click(screen.getByRole("button", { name: /Continuar después/ }));
    expect(onChoose).toHaveBeenCalledTimes(1);
    release();
    rerender(
      <I18nProvider locale="es-419">
        <Conversation messages={[{
          ...recoveryMessage,
          betaIncompleteExecutionRecoveryDecision: "retry-now",
        }]} />
      </I18nProvider>,
    );
    expect(screen.queryByRole("button", { name: /Reintentar ahora/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continuar después/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Reintento listo para el mismo paso confirmado/)).toBeVisible();
    expect(screen.getByText(/evidencia anterior permanece registrada/i)).toBeVisible();
  });

  it("keeps a consumed deferred-resume card visible while suppressing only its stale CTA", () => {
    const resumeMessage = {
      id: "resume", role: "assistant" as const, content: "Historical resume prompt",
      experience: {
        kind: "decision" as const, title: "Reanudar Mission 9",
        summary: "Reanudación pendiente", phases: [],
        choices: [{
          label: "Empezar ahora", description: "Resume", prompt: "Resume", confirmation: {
            kind: "beta-session-decision" as const, decision: "start-now" as const,
          },
        }], recommendedSurface: "presence" as const,
      },
    };
    const { rerender } = render(
      <I18nProvider locale="es-419">
        <Conversation messages={[resumeMessage]} />
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: /Empezar ahora/ })).toBeVisible();

    rerender(
      <I18nProvider locale="es-419">
        <Conversation messages={[
          { ...resumeMessage, betaSessionDecisionConfirmed: true },
          {
            id: "active", role: "assistant", content: "Current choice",
            experience: {
              kind: "decision", title: "Current", summary: "Still actionable", phases: [],
              choices: [{ label: "Acción vigente", description: "Valid", prompt: "Act" }],
              recommendedSurface: "presence",
            },
          },
        ]} />
      </I18nProvider>,
    );
    expect(screen.getByText("Historical resume prompt")).toBeVisible();
    expect(screen.getByText("Reanudar Mission 9")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Empezar ahora/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acción vigente/ })).toBeVisible();
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

  it("renders a persisted reorder as the specialized Intelligence card", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn().mockResolvedValue(undefined);
    const firstId = "00000000-0000-4000-8000-000000000001";
    const secondId = "00000000-0000-4000-8000-000000000002";
    const reorder = {
      operation: "intelligence_reorder_priorities" as const,
      executionId: "70000000-0000-4000-8000-000000000001",
      scopeType: "global" as const,
      projectId: null,
      expectedActiveProjectId: null,
      projectName: null,
      currentSummary: "Current priorities",
      proposedSummary: "Proposed priorities",
      orderedPriorityIds: [secondId, firstId],
      expectedPriorities: [
        { recordId: firstId, position: 1, updatedAt: "2026-08-21T00:00:00Z", label: "Finish Intelligence v2" },
        { recordId: secondId, position: 2, updatedAt: "2026-08-21T00:00:01Z", label: "Train consistently" },
      ],
    };
    const choices = ["confirm", "cancel"].map((decision) => ({
      label: decision === "confirm" ? "Confirm" : "Cancel",
      description: decision,
      prompt: decision,
      confirmation: {
        kind: "intelligence-action" as const,
        decision: decision as "confirm" | "cancel",
        proposal: reorder,
      },
    }));

    render(<I18nProvider locale="es-419"><Conversation onChoose={onChoose} messages={[{
      id: "reorder-source",
      role: "assistant",
      content: "Reorder global priorities",
      experience: {
        kind: "decision",
        title: "Reorder global priorities",
        summary: "Confirm the exact change",
        phases: [],
        choices,
        recommendedSurface: "presence",
      },
    }]} /></I18nProvider>);

    const card = screen.getByText("REORDER PRIORITIES").closest("section");
    expect(card).not.toBeNull();
    expect(within(card!).getByText("Current").parentElement).toHaveTextContent(/1\. Finish Intelligence v2\s+2\. Train consistently/);
    expect(within(card!).getByText("Proposed").parentElement).toHaveTextContent(/1\. Train consistently\s+2\. Finish Intelligence v2/);
    expect(within(card!).getAllByRole("button")).toHaveLength(2);
    await user.click(within(card!).getByRole("button", { name: "Cancel" }));
    expect(onChoose).toHaveBeenCalledWith(choices[1], "reorder-source");
  });

  it("offers one post-closure handoff and displays the selected disposition", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const onChoose = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const messages = [{
      id: "closed-handoff", role: "assistant" as const, content: "Closed",
      betaSessionEvaluation: { outcomeSatisfied: true, summary: "Outcome satisfied" },
      betaSessionEvaluationConfirmed: true, betaSessionClosed: true,
      experience: { kind: "decision" as const, title: "Closed", summary: "Choose",
        phases: [], recommendedSurface: "presence" as const, choices: [
          { label: "Terminar aquí", description: "Finish", prompt: "Finish",
            confirmation: { kind: "beta-post-closure-handoff" as const, decision: "finish-here" as const } },
          { label: "Comenzar otro ciclo", description: "Again", prompt: "Again",
            confirmation: { kind: "beta-post-closure-handoff" as const, decision: "begin-another-cycle" as const } },
        ] },
    }];
    const { rerender } = render(<I18nProvider locale="es-419">
      <Conversation messages={messages} onChoose={onChoose} />
    </I18nProvider>);
    const finish = screen.getByRole("button", { name: /Terminar aquí/ });
    await user.click(finish);
    expect(screen.getByRole("button", { name: /Comenzar otro ciclo/ })).toBeDisabled();
    release();
    await screen.findByText(/el fundador eligió terminar aquí/i);
    rerender(<I18nProvider locale="es-419"><Conversation messages={[{
      ...messages[0], betaPostClosureDecision: "begin-another-cycle",
    }]} onChoose={onChoose} /></I18nProvider>);
    expect(screen.getByText(/el fundador comenzó otro ciclo/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Terminar aquí/ })).not.toBeInTheDocument();
  });
});
