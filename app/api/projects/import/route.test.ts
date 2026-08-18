import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("legacy project import", () => {
  it("is permanently disabled for normal authenticated product use", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({
      error: "Legacy project import is disabled.",
      code: "IAURA_LEGACY_IMPORT_DISABLED",
    });
  });
});
