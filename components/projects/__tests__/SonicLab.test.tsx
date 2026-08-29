import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SonicLab from "../SonicLab";
import { DEFAULT_PROJECT_THEME_DNA } from "@/core/projectTheme/themeDNA";

const playAudition = vi.hoisted(() => vi.fn());
const playIaura = vi.hoisted(() => vi.fn());
const playPresence = vi.hoisted(() => vi.fn());
vi.mock("@/core/sonic/SonicDNA", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/core/sonic/SonicDNA")>();
  return { ...original, sonicEngine: { playAudition, playIaura, playPresence } };
});

describe("SonicLab", () => {
  afterEach(() => { vi.unstubAllEnvs(); playAudition.mockClear(); playIaura.mockClear(); playPresence.mockClear(); });

  it("compares the same role immediately across Deep, Crystalline and Hybrid", async () => {
    const user = userEvent.setup();
    render(<SonicLab theme={DEFAULT_PROJECT_THEME_DNA} />);
    await user.click(screen.getByRole("button", { name: "apply" }));
    await user.click(screen.getByRole("button", { name: "Compare apply Deep" }));
    await user.click(screen.getByRole("button", { name: "Compare apply Crystalline" }));
    await user.click(screen.getByRole("button", { name: "Compare apply Hybrid" }));
    expect(playAudition.mock.calls.map(([candidate, role]) => [candidate, role])).toEqual([
      ["deep", "apply"], ["crystalline", "apply"], ["hybrid", "apply"],
    ]);
  });

  it("changes Motion DNA only for audition and never exposes persistence", async () => {
    const user = userEvent.setup();
    render(<SonicLab theme={DEFAULT_PROJECT_THEME_DNA} />);
    await user.click(screen.getByRole("button", { name: "precision" }));
    await user.click(screen.getByRole("button", { name: "Play hybrid" }));
    expect(playAudition).toHaveBeenCalledWith("hybrid", "tap", expect.objectContaining({ motionStyle: "precision" }));
    expect(screen.getByText(/never changes production Sonic DNA/i)).toBeInTheDocument();
  });

  it("renders nothing in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { container } = render(<SonicLab theme={DEFAULT_PROJECT_THEME_DNA} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers development-only IAURA and Presence A/B/C instant audition", async () => {
    const user = userEvent.setup(); render(<SonicLab theme={DEFAULT_PROJECT_THEME_DNA} />);
    await user.click(screen.getByRole("button", { name: "IAURA cognitive" }));
    await user.click(screen.getByRole("button", { name: "balanced" }));
    expect(playIaura).toHaveBeenCalledWith("activation", expect.any(Object), "cognitive");
    expect(playPresence).toHaveBeenCalledWith(expect.any(Object), "balanced", false);
  });
});
