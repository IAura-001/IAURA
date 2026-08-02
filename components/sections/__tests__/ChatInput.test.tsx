import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/core/i18n/I18nContext";

const voiceMock = vi.hoisted(() => ({
  state: "idle" as const,
  transcript: "",
  voiceMode: true,
  captureMode: "browser-speech" as const,
  voiceError: null,
  setVoiceMode: vi.fn(),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  stopSpeaking: vi.fn(),
  transcribeAudioFile: vi.fn(),
  clearTranscript: vi.fn(),
  clearVoiceError: vi.fn(),
  unlockAudio: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/core/context/VoiceContext", () => ({
  useVoiceContext: () => voiceMock,
}));

import { ChatInput } from "@/components/sections/ChatInput";

function renderInput(
  onSend: (message?: string) => void | Promise<void> = vi.fn(),
  voiceEntryRequested = false,
) {
  return render(
    <I18nProvider locale="es-419">
      <ChatInput
        onSend={onSend}
        voiceEntryRequested={voiceEntryRequested}
      />
    </I18nProvider>,
  );
}

describe("ChatInput interaction feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it("focuses the ready microphone for a voice deep link without activating it", async () => {
    renderInput(vi.fn(), true);

    const microphone = screen.getByRole("button", {
      name: "Hablar con IAURA",
    });

    await waitFor(() => expect(microphone).toHaveFocus());

    expect(voiceMock.startListening).not.toHaveBeenCalled();
    expect(microphone).toHaveAttribute("aria-pressed", "false");
    expect(microphone).toHaveClass("h-12", "w-12");
    expect(
      screen.getByRole("status", {
        name: "",
      }),
    ).toHaveTextContent("IAURA no lo activará sin tu permiso");
  });

  it("shows textual loading and success feedback while sending", async () => {
    let resolveSend: (() => void) | undefined;
    const onSend = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const user = userEvent.setup();
    renderInput(onSend);

    await user.type(
      screen.getByRole("textbox", { name: /Pregúntale/i }),
      "Construye la marca",
    );
    const send = screen.getByRole("button", { name: "Enviar" });
    await user.click(send);

    expect(send).toBeDisabled();
    expect(send).toHaveAttribute("aria-busy", "true");
    expect(send).toHaveTextContent("Enviando");
    expect(send).toHaveClass("min-h-12");

    resolveSend?.();

    await waitFor(() => {
      expect(screen.getByText("Mensaje enviado")).toBeInTheDocument();
    });
  });

  it("exposes an alert and keeps the draft when sending fails", async () => {
    const user = userEvent.setup();
    renderInput(vi.fn().mockRejectedValue(new Error("offline")));
    const input = screen.getByRole("textbox", { name: /Pregúntale/i });

    await user.type(input, "No pierdas esto");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo enviar",
    );
    expect(input).toHaveValue("No pierdas esto");
  });
});
