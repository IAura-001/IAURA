import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ProjectThemeDemoSelector from "../ProjectThemeDemoSelector";
import { DEFAULT_PROJECT_THEME_DNA, PROJECT_THEME_PRESETS } from "@/core/projectTheme/themeDNA";

describe("ProjectThemeDemoSelector", () => {
  it("previews fixtures without exposing persistence", async () => {
    const onPreview = vi.fn(); const user = userEvent.setup();
    render(<ProjectThemeDemoSelector savedTheme={DEFAULT_PROJECT_THEME_DNA} onPreview={onPreview} />);
    await user.click(screen.getByRole("button", { name: "Auto Sales" }));
    expect(onPreview).toHaveBeenCalledWith(PROJECT_THEME_PRESETS.autoSales);
    await user.click(screen.getByRole("button", { name: "VAEORA Original" }));
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(/never persisted/i)).toBeInTheDocument();
  });

  it("simulates living context only through an explicit development callback", async () => {
    const onContextPreview = vi.fn();
    render(<ProjectThemeDemoSelector savedTheme={DEFAULT_PROJECT_THEME_DNA} onPreview={vi.fn()} onContextPreview={onContextPreview} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "processing" }));
    expect(onContextPreview).toHaveBeenCalledWith("processing");
    await userEvent.setup().click(screen.getByRole("button", { name: "Real context" }));
    expect(onContextPreview).toHaveBeenLastCalledWith(null);
  });
});
