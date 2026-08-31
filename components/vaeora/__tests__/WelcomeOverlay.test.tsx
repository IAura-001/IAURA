import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WelcomeOverlay from "../WelcomeOverlay";

describe("commercial welcome overlay", () => {
  it("is an accessible, text-first intent entry and does not require voice", () => {
    render(<WelcomeOverlay userName="Maya" onLaunch={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: /what do you want to launch, maya/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Your launch intention")).toBeInTheDocument();
    expect(screen.queryByText(/microphone|voice permission/i)).not.toBeInTheDocument();
  });

  it("does not submit empty intent and submits a meaningful intent once", async () => {
    const user = userEvent.setup(); const onLaunch = vi.fn().mockResolvedValue(undefined);
    render(<WelcomeOverlay userName="" onLaunch={onLaunch} onSkip={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "Turn this into a project" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Your launch intention"), "I want to launch a premium skincare brand.");
    await user.click(submit);
    expect(onLaunch).toHaveBeenCalledTimes(1);
  });

  it("allows a lower-prominence escape into the normal workspace", async () => {
    const user = userEvent.setup(); const onSkip = vi.fn();
    render(<WelcomeOverlay userName="" onLaunch={vi.fn()} onSkip={onSkip} />);
    await user.click(screen.getByRole("button", { name: "Use the workspace without setup" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
