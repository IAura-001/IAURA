import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AuthenticatedIdentityBoundary from "../AuthenticatedIdentityBoundary";
import { useAuthenticatedIdentity } from "@/core/profile/AuthenticatedIdentityContext";
import type { AuthenticatedProfile } from "@/core/profile/types";

function IdentityValue() {
  return <span>{useAuthenticatedIdentity()?.displayName ?? "neutral"}</span>;
}

const profile = (id: string, displayName: string): AuthenticatedProfile => ({ id, firstName: displayName, lastName: null, displayName, onboardingCompleted: true });

describe("AuthenticatedIdentityBoundary", () => {
  it("shows onboarding for an incomplete authenticated profile without rendering workspace children", () => {
    render(<AuthenticatedIdentityBoundary profile={{ ...profile("a", ""), firstName: null, displayName: null, onboardingCompleted: false }}><p>workspace</p></AuthenticatedIdentityBoundary>);
    expect(screen.getByRole("heading", { name: "Antes de comenzar." })).toBeVisible();
    expect(screen.queryByText("workspace")).not.toBeInTheDocument();
  });

  it("bypasses onboarding and replaces identity when the account changes", () => {
    const { rerender } = render(<AuthenticatedIdentityBoundary profile={profile("a", "Diego")}><IdentityValue /></AuthenticatedIdentityBoundary>);
    expect(screen.getByText("Diego")).toBeVisible();
    rerender(<AuthenticatedIdentityBoundary profile={profile("b", "Carlos")}><IdentityValue /></AuthenticatedIdentityBoundary>);
    expect(screen.getByText("Carlos")).toBeVisible();
    expect(screen.queryByText("Diego")).not.toBeInTheDocument();
  });
});
