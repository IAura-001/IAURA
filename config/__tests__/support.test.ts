import { describe, expect, it } from "vitest";

import { resolveVaeoraSupportUrl } from "../support";

const testLink = "https://buy.stripe.com/test_fZu28q20L0XF4Eu6zYe7m00";

describe("VAEORA support configuration", () => {
  it("uses the tested Payment Link outside production", () => {
    expect(resolveVaeoraSupportUrl(undefined, "development")).toBe(testLink);
  });

  it("fails closed when production has no live Payment Link", () => {
    expect(resolveVaeoraSupportUrl(undefined, "production")).toBeNull();
    expect(resolveVaeoraSupportUrl(testLink, "production")).toBeNull();
  });

  it("accepts only HTTPS Stripe Payment Links", () => {
    expect(resolveVaeoraSupportUrl("https://example.com/pay", "development"))
      .toBeNull();
    expect(resolveVaeoraSupportUrl("https://buy.stripe.com/live_link", "production"))
      .toBe("https://buy.stripe.com/live_link");
  });
});
