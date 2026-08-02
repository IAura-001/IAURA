import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import BrandingStudio from "@/components/sections/BrandingStudio";
import { I18nProvider } from "@/core/i18n/I18nContext";
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
};

function renderStudio(onClose = vi.fn()) {
  const result = render(
    <I18nProvider locale="es-419">
      <BrandingStudio
        project={project}
        onClose={onClose}
        onSave={vi.fn()}
      />
    </I18nProvider>,
  );

  return { ...result, onClose };
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  vi.restoreAllMocks();
});

describe("BrandingStudio navigation and scrolling", () => {
  it("renders above the workspace chrome with an independent viewport scroller", () => {
    const { unmount } = renderStudio();
    const dialog = screen.getByRole("dialog", { name: "Estudio de marca" });

    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass(
      "z-[200]",
      "h-[100dvh]",
      "overflow-y-scroll",
      "overscroll-y-contain",
    );
    expect(document.body).toHaveStyle({ overflow: "hidden" });
    expect(screen.getByRole("button", { name: "Volver" })).toHaveFocus();

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("offers an explicit return control and preserves Escape navigation", async () => {
    const user = userEvent.setup();
    const { onClose } = renderStudio();

    await user.click(screen.getByRole("button", { name: "Volver" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
