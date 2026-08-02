import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VaeoraPhenomenon from "@/components/vaeora/VaeoraPhenomenon";

describe("VaeoraPhenomenon", () => {
  let reducedMotionListener: ((event: MediaQueryListEvent) => void) | null;
  const observe = vi.fn();
  const disconnect = vi.fn();
  const addEventListener = vi.fn(
    (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      reducedMotionListener = listener;
    },
  );
  const removeEventListener = vi.fn();
  const requestAnimationFrame = vi.fn(() => 17);
  const cancelAnimationFrame = vi.fn();

  beforeEach(() => {
    reducedMotionListener = null;
    vi.clearAllMocks();

    const mediaQuery = {
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;

    vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        observe = observe;
        disconnect = disconnect;
      },
    );

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(
      HTMLCanvasElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 800,
      bottom: 600,
      left: 0,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("restarts rendering when reduced-motion changes and removes the listener", () => {
    const { unmount } = render(
      <VaeoraPhenomenon activeSignal={null} />,
    );

    expect(addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    act(() => {
      reducedMotionListener?.({ matches: true } as MediaQueryListEvent);
    });

    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);

    const listener = reducedMotionListener;
    unmount();

    expect(removeEventListener).toHaveBeenCalledWith("change", listener);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
