import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FounderProjectImport from "../FounderProjectImport";

describe("FounderProjectImport", () => {
  it("keeps legacy local project import unavailable in normal product use", () => {
    render(<FounderProjectImport />);

    expect(
      screen.queryByRole("button", {
        name: /Importar proyectos locales/i,
      }),
    ).toBeNull();
  });
});
