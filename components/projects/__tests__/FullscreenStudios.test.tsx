import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import LegacyBrandingStudio from "@/components/projects/BrandingStudio";
import LaunchStudio from "@/components/projects/LaunchStudio";
import type { IAuraProject } from "@/types/project";

const project: IAuraProject = {
  id: "project-mita",
  name: "Mita",
  description: "Una identidad inteligente.",
  goal: "Construir un sistema de marca coherente.",
  createdAt: "2026-08-02T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
  status: "building",
  studios: {
    branding: true,
    website: false,
    app: false,
    marketing: false,
    documents: false,
  },
  brandingStudio: {
    prompts: {},
    generatedContent: {},
    updatedAt: "",
  },
  launchStudio: {
    assets: [
      {
        id: "teaser-02",
        title: "Teaser 02",
        type: "Instagram teaser",
        status: "approved",
        content: "Every project needs a mind.",
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      },
    ],
    updatedAt: "2026-08-02T00:00:00.000Z",
  },
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.body.style.overflow = "";
});

describe.each([
  ["Branding Studio heredado", LegacyBrandingStudio],
  ["Launch Studio", LaunchStudio],
])("%s fullscreen navigation", (_label, Studio) => {
  it("renders above the workspace with its own mobile-safe scroller", async () => {
    const onClose = vi.fn();
    const { unmount } = render(<Studio project={project} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Mita" });

    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass(
      "z-[200]",
      "h-[100dvh]",
      "overflow-y-scroll",
      "overscroll-y-contain",
    );
    expect(document.body).toHaveStyle({ overflow: "hidden" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Volver/ })).toHaveFocus();
    });

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes from the visible return control and the Escape key", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<Studio project={project} onClose={onClose} />);
    await screen.findByRole("dialog", { name: "Mita" });

    await user.click(screen.getByRole("button", { name: /Volver/ }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
