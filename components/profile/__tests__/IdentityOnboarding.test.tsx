import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IdentityOnboarding from "../IdentityOnboarding";

describe("IdentityOnboarding", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("requires a first name and performs no write during render", () => {
    render(<IdentityOnboarding />);
    expect(screen.getByRole("button", { name: "CONTINUAR" })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("derives then allows customization of the display name", () => {
    render(<IdentityOnboarding />);
    const firstName = screen.getByLabelText("Nombre");
    const displayName = screen.getByLabelText("¿Cómo quieres que Aura te llame?");
    fireEvent.change(firstName, { target: { value: "Katherine" } });
    expect(displayName).toHaveValue("Katherine");
    fireEvent.change(displayName, { target: { value: "Kat" } });
    fireEvent.change(firstName, { target: { value: "Katherine Marie" } });
    expect(displayName).toHaveValue("Kat");
    expect(screen.getByRole("button", { name: "CONTINUAR" })).toBeEnabled();
  });

  it("submits customized identity once without a client owner id", () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => undefined));
    render(<IdentityOnboarding />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Carlos" } });
    fireEvent.change(screen.getByLabelText("¿Cómo quieres que Aura te llame?"), { target: { value: "Carl" } });
    const button = screen.getByRole("button", { name: "CONTINUAR" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/profile", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ firstName: "Carlos", lastName: "", displayName: "Carl" }),
    }));
    expect(vi.mocked(fetch).mock.calls[0][1]?.body).not.toContain("userId");
  });
});
