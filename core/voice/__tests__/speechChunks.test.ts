import {
  describe,
  expect,
  it,
} from "vitest";

import { splitSpeechText } from "../speechChunks";

describe("Aura Prime speech chunks", () => {
  it("starts with a short complete phrase", () => {
    const chunks = splitSpeechText(
      "Hola, Diego. Estoy aquí para ayudarte a decidir con claridad. Después construiremos el siguiente paso juntos, revisaremos cada opción con calma y convertiremos la decisión en una acción concreta que puedas comenzar hoy mismo."
    );

    expect(chunks[0]).toBe(
      "Hola, Diego. Estoy aquí para ayudarte a decidir con claridad."
    );
    expect(chunks.join(" ")).toContain(
      "siguiente paso juntos"
    );
  });

  it("keeps every chunk within its latency target", () => {
    const chunks = splitSpeechText(
      Array.from(
        { length: 180 },
        (_, index) => `palabra${index}`
      ).join(" ")
    );

    expect(chunks[0].length).toBeLessThanOrEqual(
      170
    );
    expect(
      chunks.slice(1).every(
        (chunk) => chunk.length <= 420
      )
    ).toBe(true);
  });
});
