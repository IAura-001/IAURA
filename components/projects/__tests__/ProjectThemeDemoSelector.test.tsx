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
    await user.click(screen.getByRole("button", { name: "Saved theme" }));
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(/never persisted/i)).toBeInTheDocument();
  });
});
