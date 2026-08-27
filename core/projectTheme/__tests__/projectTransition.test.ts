import { describe, expect, it, vi } from "vitest";

import { runProjectContextTransition } from "../projectTransition";

describe("project context transition", () => {
  it("applies navigation synchronously when transitions are unavailable", () => {
    const apply = vi.fn();
    runProjectContextTransition(apply, { document: {} as Document });
    expect(apply).toHaveBeenCalledOnce();
  });

  it("bypasses decorative transitions for reduced motion", () => {
    const startViewTransition = vi.fn();
    const apply = vi.fn();
    runProjectContextTransition(apply, { document: { startViewTransition } as unknown as Document, reducedMotion: true });
    expect(apply).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("cancels stale visual work before the next authoritative selection", () => {
    const firstApply = vi.fn(); const secondApply = vi.fn(); const skipTransition = vi.fn();
    const transitionDocument = {
      startViewTransition: vi.fn((callback: () => void) => {
        callback();
        return { skipTransition, finished: new Promise(() => undefined) };
      }),
    } as unknown as Document;
    runProjectContextTransition(firstApply, { document: transitionDocument });
    runProjectContextTransition(secondApply, { document: transitionDocument });
    expect(firstApply).toHaveBeenCalledOnce();
    expect(secondApply).toHaveBeenCalledOnce();
    expect(skipTransition).toHaveBeenCalledOnce();
  });

  it("falls back exactly once when a supported browser fails to start", () => {
    const apply = vi.fn();
    const transitionDocument = {
      startViewTransition: vi.fn(() => { throw new DOMException("Invalid transition state"); }),
    } as unknown as Document;
    expect(() => runProjectContextTransition(apply, { document: transitionDocument })).not.toThrow();
    expect(apply).toHaveBeenCalledOnce();
  });

  it("does not reapply selection if the browser throws after invoking the callback", () => {
    const apply = vi.fn();
    const transitionDocument = {
      startViewTransition: vi.fn((callback: () => void) => {
        callback();
        throw new DOMException("Transition setup failed");
      }),
    } as unknown as Document;
    runProjectContextTransition(apply, { document: transitionDocument });
    expect(apply).toHaveBeenCalledOnce();
  });

  it("absorbs a rejected decorative finished promise", async () => {
    const transitionDocument = {
      startViewTransition: vi.fn((callback: () => void) => {
        callback();
        return { finished: Promise.reject(new DOMException("Skipped")) };
      }),
    } as unknown as Document;
    runProjectContextTransition(vi.fn(), { document: transitionDocument });
    await Promise.resolve();
    await Promise.resolve();
  });
});
