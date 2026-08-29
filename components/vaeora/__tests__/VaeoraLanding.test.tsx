import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const play = vi.hoisted(() => vi.fn());
vi.mock("@/core/sonic/SonicDNA", () => ({ sonicEngine: { play } }));

vi.mock("@/components/vaeora/VaeoraPhenomenon", () => ({
  default: ({ activeSignal }: { activeSignal: string | null }) => (
    <output data-testid="phenomenon" data-signal={activeSignal ?? "idle"} />
  ),
}));

import VaeoraLanding from "@/components/vaeora/VaeoraLanding";

describe("VaeoraLanding", () => {
  it("offers a neutral entry and three functional capability links", () => {
    render(<VaeoraLanding />);

    expect(
      screen.getByRole("link", { name: "Enter VAEORA" }),
    ).toHaveAttribute("href", "/iaura");
    expect(
      screen.getByRole("link", { name: "Presence" }),
    ).toHaveAttribute("href", "/iaura?view=presence&intent=voice");
    expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute(
      "href",
      "/iaura?view=projects&intent=branding",
    );
    expect(
      screen.getByRole("link", { name: "Intelligence" }),
    ).toHaveAttribute("href", "/iaura?view=intelligence");
    expect(screen.getByRole("link", { name: "Support VAEORA" }))
      .toHaveAttribute("href", "/support");
  });

  it("lets keyboard focus tune the phenomenon without activating a link", async () => {
    const user = userEvent.setup();
    render(<VaeoraLanding />);

    await user.tab();
    expect(
      screen.getByRole("link", { name: "Enter VAEORA" }),
    ).toHaveFocus();
    expect(screen.getByTestId("phenomenon")).toHaveAttribute(
      "data-signal",
      "idle",
    );

    await user.tab();
    expect(
      screen.getByRole("link", { name: "Support VAEORA" }),
    ).toHaveFocus();

    await user.tab();
    const presence = screen.getByRole("link", { name: "Presence" });
    expect(presence).toHaveFocus();
    expect(presence).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("phenomenon")).toHaveAttribute(
      "data-signal",
      "presence",
    );

    await user.tab();
    const creation = screen.getByRole("link", { name: "Create" });
    expect(creation).toHaveFocus();
    expect(creation).toHaveAttribute("data-active", "true");
    expect(presence).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("phenomenon")).toHaveAttribute(
      "data-signal",
      "creation",
    );
  });

  it("exposes immediate pressed feedback to pointer and touch input", () => {
    render(<VaeoraLanding />);

    const creation = screen.getByRole("link", { name: "Create" });
    fireEvent.pointerDown(creation, { pointerType: "touch" });

    expect(creation).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("phenomenon")).toHaveAttribute(
      "data-signal",
      "creation",
    );

    fireEvent.pointerCancel(creation, { pointerType: "touch" });
    expect(creation).toHaveAttribute("data-active", "false");
  });

  it("plays exactly one VAEORA entry mark from the trusted navigation click", async () => {
    const user = userEvent.setup();
    render(<VaeoraLanding />);
    const entry = screen.getByRole("link", { name: "Enter VAEORA" });
    entry.addEventListener("click", (event) => event.preventDefault());
    await user.click(entry);
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith("open");
    expect(entry).toHaveAttribute("href", "/iaura");
  });
});
