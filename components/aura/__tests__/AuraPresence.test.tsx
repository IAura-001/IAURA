import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/core/i18n/I18nContext";

const playPresence = vi.hoisted(() => vi.fn(() => 7));
const cancelPresence = vi.hoisted(() => vi.fn());
const playIaura = vi.hoisted(() => vi.fn());
vi.mock("@/core/sonic/SonicDNA", () => ({ sonicEngine: { playPresence, cancelPresence, playIaura } }));

const voice = vi.hoisted(() => ({ state: "idle" as "idle" | "listening" | "processing" | "speaking" }));
vi.mock("@/core/context/VoiceContext", () => ({ useVoiceContext: () => ({ state: voice.state }) }));

import { AuraPresence } from "@/components/aura/AuraPresence";

function renderPresence(
  isLive: boolean,
  onToggleLive?: () => void,
  phase: "idle" | "awakening" = "idle",
  sonicTheme?: React.ComponentProps<typeof AuraPresence>["sonicTheme"],
) {
  return render(
    <I18nProvider locale="es-419">
      <AuraPresence
        phase={phase}
        isLive={isLive}
        onToggleLive={onToggleLive}
        sonicTheme={sonicTheme}
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

  it("uses project colors for idle while preserving the historical state palette", () => {
    const { container } = renderPresence(false, vi.fn());
    expect(container.querySelector(".aura-presence")).toHaveAttribute("data-voice-state", "idle");
    expect(container.innerHTML).toContain("--iaura-primary-rgb");
    expect(container.innerHTML).toContain(".aura-listening { --aura-primary: 34, 211, 238;");
    expect(container.innerHTML).toContain(".aura-processing { --aura-primary: 245, 158, 11;");
    expect(container.innerHTML).toContain(".aura-speaking { --aura-primary: 236, 72, 153;");
    expect(container.innerHTML).toContain(".aura-awakening { --aura-primary: 192, 132, 252;");
  });

  it("restores the original visual layers and removes rejected technical experiments", () => {
    const view = renderPresence(false, vi.fn());
    expect(view.container.querySelectorAll(".aura-star")).toHaveLength(12);
    expect(view.container.querySelectorAll(".aura-orbit")).toHaveLength(3);
    expect(view.container.querySelector(".aura-core-shell")).toBeInTheDocument();
    expect(view.container.querySelector(".aura-mark")).toBeInTheDocument();
    expect(view.container.querySelector(".aura-traces")).not.toBeInTheDocument();
    expect(view.container.querySelector(".aura-resonance")).not.toBeInTheDocument();
    expect(view.container.querySelector(".aura-grid")).not.toBeInTheDocument();
  });

  it("restores the original deterministic motion channels without a JavaScript frame loop", () => {
    const { container } = renderPresence(false, vi.fn());
    const css = container.innerHTML;
    expect(css).toContain("animation: aura-orbit-one 10s linear infinite");
    expect(css).toContain("animation: aura-orbit-two 13s linear infinite reverse");
    expect(css).toContain("animation: aura-orbit-three 16s linear infinite");
    expect(css).toContain("animation: aura-nebula 8s ease-in-out infinite alternate");
    expect(css).toContain("animation: aura-breathe 4.2s ease-in-out infinite");
    expect(css).toContain("animation: aura-core 2.8s ease-in-out infinite");
    expect(css).not.toContain("trace-life");
    expect(css).not.toContain("core-shape");
    expect(css).not.toContain("requestAnimationFrame");
  });

  it("keeps premium static state structure under reduced motion", () => {
    const { container } = renderPresence(false, vi.fn());
    expect(container.innerHTML).toContain("@media (prefers-reduced-motion: reduce)");
    expect(container.innerHTML).toContain("animation: none");
    expect(container.innerHTML).toContain(".aura-listening .aura-wave span");
  });

  it("anchors the waveform and lower indicator to one state-independent visual axis", () => {
    const { container } = renderPresence(false, vi.fn());
    const waveform = container.querySelector('[data-presence-axis="waveform"]');
    const indicator = container.querySelector('[data-presence-axis="indicator"]');
    expect(waveform).toHaveClass("aura-audio-axis", "w-[85px]");
    expect(indicator).toHaveClass("aura-audio-axis");
    expect(container.innerHTML).toContain("left: 50%; translate: -50% 0; transform-origin: 50% 50%");
    expect(container.innerHTML).not.toContain(".aura-processing .aura-wave { transform:");
  });

  it.each(["idle", "listening", "processing", "speaking"] as const)(
    "derives the %s visual identity only from authoritative VoiceContext state",
    (visualState) => {
      voice.state = visualState;
      const { container } = renderPresence(true, vi.fn());
      const presence = container.querySelector(".aura-presence");
      expect(presence).toHaveAttribute("data-voice-state", visualState);
      expect(presence).toHaveClass(`aura-${visualState}`);
      voice.state = "idle";
    },
  );

  it("lets awakening override presentation while leaving VoiceContext untouched", () => {
    voice.state = "processing";
    const { container } = renderPresence(false, vi.fn(), "awakening");
    expect(container.querySelector(".aura-presence")).toHaveAttribute("data-voice-state", "awakening");
    expect(voice.state).toBe("processing");
    voice.state = "idle";
  });

  it("preserves canonical IAURA and exposes custom Motion DNA without project-name coupling", () => {
    const canonical = renderPresence(false, vi.fn());
    expect(canonical.container.querySelector(".aura-presence")).toHaveAttribute("data-motion-style", "canonical");
    canonical.unmount();
    const theme = { version: 1, primaryColor: "#123456", secondaryColor: "#456789", accentColor: "#ABCDEF", surfaceMode: "dark", visualIntensity: "balanced", surfacePersonality: "crisp", motionStyle: "precision" } as const;
    const custom = renderPresence(false, vi.fn(), "idle", theme);
    expect(custom.container.querySelector(".aura-presence")).toHaveAttribute("data-motion-style", "precision");
    expect(custom.container.innerHTML).not.toContain("presetId");
    expect(custom.container.innerHTML).toContain("--iaura-primary-rgb");
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

  it("synchronizes and cleans the Fusion cue against the real awakening phase", () => {
    const { unmount } = renderPresence(false, vi.fn(), "awakening");
    expect(playPresence).toHaveBeenCalledWith(undefined, "balanced", false);
    expect(playIaura).not.toHaveBeenCalled();
    unmount();
    expect(cancelPresence).toHaveBeenCalledWith(7);
  });

  it("assigns Aura Live activation to IAURA without sounding the stop action", () => {
    const toggle = vi.fn();
    const { rerender } = renderPresence(false, toggle);
    screen.getByRole("button").click();
    expect(playIaura).toHaveBeenCalledWith("activation", undefined, "hybrid", false);
    expect(toggle).toHaveBeenCalledTimes(1);
    rerender(<I18nProvider locale="es-419"><AuraPresence phase="idle" isLive onToggleLive={toggle} /></I18nProvider>);
    screen.getByRole("button").click();
    expect(playIaura).toHaveBeenCalledTimes(1);
  });

  it("observes active voice without mutating voice or sonic authority", () => {
    voice.state = "listening";
    renderPresence(false, vi.fn());
    screen.getByRole("button").click();
    expect(playIaura).toHaveBeenCalledWith("activation", undefined, "hybrid", true);
    voice.state = "idle";
  });

  it("always invokes Hands-Free when sonic playback throws", () => {
    const toggle = vi.fn();
    playIaura.mockImplementationOnce(() => { throw new Error("Web Audio failed"); });
    renderPresence(false, toggle);
    expect(() => screen.getByRole("button").click()).not.toThrow();
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("still invokes Hands-Free when sonic playback is muted or unsupported", () => {
    const toggle = vi.fn();
    playIaura.mockReturnValueOnce(false).mockReturnValueOnce(false);
    const view = renderPresence(false, toggle);
    screen.getByRole("button").click();
    view.rerender(<I18nProvider locale="es-419"><AuraPresence phase="idle" isLive={false} onToggleLive={toggle} /></I18nProvider>);
    screen.getByRole("button").click();
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it("does not replay Fusion on an equivalent rerender", () => {
    const view = renderPresence(false, vi.fn(), "awakening");
    const calls = playPresence.mock.calls.length;
    view.rerender(<I18nProvider locale="es-419"><AuraPresence phase="awakening" isLive={false} onToggleLive={vi.fn()} /></I18nProvider>);
    expect(playPresence).toHaveBeenCalledTimes(calls);
  });
});
