import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Hero from "../Hero";
import { I18nProvider } from "@/core/i18n/I18nContext";

describe("Hero authenticated identity", () => {
  it("uses the current profile name and falls back neutrally", () => {
    const { rerender } = render(<I18nProvider locale="es-419"><Hero name="Carlos" /></I18nProvider>);
    expect(screen.getByText("Hola, Carlos.")).toBeVisible();
    rerender(<I18nProvider locale="es-419"><Hero name="" /></I18nProvider>);
    expect(screen.getByText("Hola.")).toBeVisible();
    expect(screen.queryByText(/Diego/)).not.toBeInTheDocument();
  });
});
