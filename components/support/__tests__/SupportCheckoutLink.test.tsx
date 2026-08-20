import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SupportCheckoutLink from "../SupportCheckoutLink";

describe("SupportCheckoutLink", () => {
  it("links to Stripe and exposes immediate loading feedback", () => {
    render(<SupportCheckoutLink href="https://buy.stripe.com/test_example" />);
    const link = screen.getByRole("link", { name: /Back the vision/i });

    expect(link).toHaveAttribute("href", "https://buy.stripe.com/test_example");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(link);
    expect(link).toHaveAttribute("aria-busy", "true");
    expect(link).toHaveTextContent("Opening secure checkout…");
  });
});
