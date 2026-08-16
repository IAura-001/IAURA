import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SignupPage from "./page";

describe("SignupPage", () => {
  it("offers login after an email-confirmation-required signup", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({ confirmation: "required", next: "/iaura?view=projects" }) }));

    expect(screen.getByRole("heading", { name: "Revisa tu correo." })).toBeInTheDocument();
    expect(screen.getByText("Enviamos un enlace para confirmar tu identidad y continuar a IAURA.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /iniciar sesión/i })).toHaveAttribute("href", "/login?next=%2Fiaura%3Fview%3Dprojects");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /crear identidad/i })).not.toBeInTheDocument();
  });

  it("retains the existing error state for signup failures", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({ error: "signup", next: "/iaura" }) }));

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos crear la cuenta con esos datos.");
    expect(screen.getByRole("button", { name: /crear identidad/i })).toBeInTheDocument();
  });
});
