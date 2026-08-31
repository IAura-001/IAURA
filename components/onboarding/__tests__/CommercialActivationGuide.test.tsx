import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CommercialActivationGuide from "../CommercialActivationGuide";

describe("CommercialActivationGuide", () => {
  it("offers one durable save only after a project result", async () => {
    const user = userEvent.setup(); const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<CommercialActivationGuide hasProjectResult={false}
      hasDurableDirection={false} nextAction="continue-with-aura" isBusy={false}
      onSaveDirection={save} onNextAction={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Save this direction" })).not.toBeInTheDocument();
    rerender(<CommercialActivationGuide hasProjectResult hasDurableDirection={false}
      nextAction="continue-with-aura" isBusy={false} onSaveDirection={save} onNextAction={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save this direction" }));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("transitions naturally to one next best action", async () => {
    const user = userEvent.setup(); const next = vi.fn();
    render(<CommercialActivationGuide hasProjectResult hasDurableDirection
      nextAction="build-brand-system" isBusy={false} onSaveDirection={vi.fn()} onNextAction={next} />);
    expect(screen.getByText("Your launch foundation is started.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Build the Brand System" }));
    expect(next).toHaveBeenCalledWith("build-brand-system");
  });
});
