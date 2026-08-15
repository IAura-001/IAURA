import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import AccessPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AccessPage interaction feedback", () => {
  it("moves from quiet presence to engaged presence as the key is entered", async () => {
    const user = userEvent.setup();
    const { container } = render(<AccessPage />);
    const gateway = container.querySelector("main");
    const input = screen.getByLabelText("CLAVE DE ACCESO");

    expect(gateway).toHaveAttribute("data-presence", "idle");
    expect(input).toBeEnabled();
    expect(input).not.toHaveAttribute("readonly");

    await user.click(input);
    expect(input).toHaveFocus();
    expect(gateway).toHaveAttribute("data-presence", "engaged");

    await user.type(input, "private-key");
    expect(input).toHaveValue("private-key");
    await user.tab();
    expect(gateway).toHaveAttribute("data-presence", "engaged");
    expect(screen.getByText("SIGNAL RECEIVED")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("explains a rate limit instead of reporting a wrong key", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many attempts" }), {
        status: 429,
        headers: { "Retry-After": "120" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AccessPage />);
    await user.type(screen.getByLabelText("CLAVE DE ACCESO"), "private-key");
    await user.click(screen.getByRole("button", { name: "Entrar a IAURA" }));

    expect(
      await screen.findByText(/Demasiados intentos\. Espera 2 min/i),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Entrar a IAURA" })).toHaveAttribute(
      "data-state",
      "error",
    );
    expect(document.querySelector("main")).toHaveAttribute(
      "data-presence",
      "unrecognized",
    );
  });

  it("exposes an immediate loading state while access is being checked", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    render(<AccessPage />);
    await user.type(screen.getByLabelText("CLAVE DE ACCESO"), "private-key");
    await user.click(screen.getByRole("button", { name: "Entrar a IAURA" }));

    const loadingButton = screen.getByRole("button", {
      name: "Abriendo IAURA...",
    });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveAttribute("aria-busy", "true");
    expect(loadingButton).toHaveAttribute("data-state", "loading");
    expect(loadingButton.textContent).not.toMatch(/[↗➡→]/u);
    expect(loadingButton.querySelector("svg")).toBeInTheDocument();
  });
});
