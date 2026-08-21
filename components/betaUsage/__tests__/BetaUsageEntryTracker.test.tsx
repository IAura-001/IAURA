import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/core/betaUsage/client", () => ({ trackBetaUsage: track }));

import BetaUsageEntryTracker from "../BetaUsageEntryTracker";

describe("BetaUsageEntryTracker", () => {
  beforeEach(() => { sessionStorage.clear(); track.mockReset().mockResolvedValue(true); });

  it("records entry once despite rerenders", async () => {
    const { rerender } = render(<BetaUsageEntryTracker userId="user-a" />);
    rerender(<BetaUsageEntryTracker userId="user-a" />);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({ type: "beta_signed_in" });
    const today = new Date().toISOString().slice(0, 10);
    await waitFor(() => expect(sessionStorage.getItem(`vaeora-beta-entered:v2:user-a:${today}`)).toBe("1"));
  });

  it("does not suppress retry after persistence fails", async () => {
    track.mockResolvedValue(false);
    const { unmount } = render(<BetaUsageEntryTracker userId="user-a" />);
    await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
    unmount();
    render(<BetaUsageEntryTracker userId="user-a" />);
    await waitFor(() => expect(track).toHaveBeenCalledTimes(2));
  });

  it("ignores a legacy dedupe key created before persistence was confirmed", async () => {
    const today = new Date().toISOString().slice(0, 10);
    sessionStorage.setItem(`vaeora-beta-entered:user-a:${today}`, "1");
    render(<BetaUsageEntryTracker userId="user-a" />);
    await waitFor(() => expect(track).toHaveBeenCalledWith({ type: "beta_signed_in" }));
  });
});
