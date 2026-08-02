import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/core/i18n/I18nContext";

vi.mock("@/core/context/VoiceContext", () => ({
  useVoiceContext: () => ({ state: "idle" }),
}));

import { AuraPresence } from "@/components/aura/AuraPresence";

function renderPresence(
  isLive: boolean,
  onToggleLive?: () => void,
) {
  return render(
    <I18nProvider locale="es-419">
      <AuraPresence
        phase="idle"
        isLive={isLive}
        onToggleLive={onToggleLive}
      />
    </I18nProvider>,
  );
}

describe("AuraPresence live control", () => {
  it("pairs pressed state with visible, non-color status feedback", () => {
    renderPresence(true, vi.fn());

    const control = screen.getByRole("button", {
      name: "Cerrar conversación con Aura",
    });

    expect(control).toHaveAttribute("aria-pressed", "true");
    expect(control).toHaveAttribute("data-state", "active");
    expect(control).toHaveClass("h-32", "w-32");
    expect(screen.getByRole("status")).toHaveTextContent(
      "◆Aura Live activa",
    );
  });

  it("communicates when Aura Live is disabled", () => {
    renderPresence(false);

    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute(
      "data-state",
      "disabled",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Aura Live no disponible",
    );
  });
});
