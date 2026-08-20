import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SupportPage from "../page";

describe("SupportPage", () => {
  it("renders the v1 support experience with safe return navigation", () => {
    render(<SupportPage />);

    expect(screen.getByRole("heading", { name: "Back the vision." })).toBeVisible();
    expect(screen.getByText(/maintain infrastructure/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /Back the vision/i }))
      .toHaveAttribute("href", expect.stringMatching(/^https:\/\/buy\.stripe\.com\/test_/));
    expect(screen.getByRole("link", { name: "Return to IAURA" }))
      .toHaveAttribute("href", "/iaura");
    expect(screen.getByRole("link", { name: "Return to VAEORA" }))
      .toHaveAttribute("href", "/");
  });
});
