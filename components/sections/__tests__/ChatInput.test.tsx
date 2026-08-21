import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/core/i18n/I18nContext";
import type { VoiceCaptureMode, VoiceError } from "@/hooks/useVoice";

const voiceMock = vi.hoisted(() => ({
  state: "idle" as "idle" | "listening" | "processing" | "speaking",
  transcript: "",
  voiceMode: true,
  captureMode: "speech-recognition" as VoiceCaptureMode,
  voiceError: null as VoiceError,
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
    voiceMock.state = "idle";
    voiceMock.transcript = "";
    voiceMock.captureMode = "speech-recognition";
    voiceMock.voiceError = null;
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

  it("never opens the audio picker when an insecure context needs HTTPS", async () => {
    voiceMock.captureMode = "secure-context-required";
    voiceMock.voiceError = "unavailable";
    const user = userEvent.setup();
    const { container } = renderInput();
    const audioInput = container.querySelector<HTMLInputElement>(
      'input[type="file"][accept="audio/*"]',
    );
    const pickerClick = vi.spyOn(audioInput!, "click");

    await user.click(
      screen.getByRole("button", { name: "Hablar con IAURA" }),
    );

    expect(voiceMock.startListening).toHaveBeenCalledOnce();
    expect(pickerClick).not.toHaveBeenCalled();
    expect(audioInput).not.toHaveAttribute("capture");
    expect(screen.getByRole("alert")).toHaveTextContent("HTTPS");
    expect(screen.getByRole("textbox")).toBeEnabled();
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

  it("forwards one published hands-free transcript to onSend", async () => {
    const onSend = vi.fn(() => new Promise<void>(() => undefined));
    const view = renderInput(onSend);

    voiceMock.state = "processing";
    voiceMock.transcript = "Quiero organizar mis proyectos";
    view.rerender(
      <I18nProvider locale="es-419">
        <ChatInput onSend={onSend} />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledOnce();
    });
    expect(onSend).toHaveBeenCalledWith("Quiero organizar mis proyectos");

    view.rerender(
      <I18nProvider locale="es-419">
        <ChatInput onSend={onSend} />
      </I18nProvider>,
    );
    expect(onSend).toHaveBeenCalledOnce();
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
