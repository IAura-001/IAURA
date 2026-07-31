import { describe, expect, it } from "vitest";
import { assessAutonomy } from "../SupervisedAutonomy";
import type { BrainContext } from "../../brain/types";

function createContext(message: string): BrainContext {
  return {
    message,
    userContext: "Test user",
    createdAt: "2026-07-30T00:00:00.000Z",
  };
}

describe("SupervisedAutonomy", () => {
  it("proceeds by default with routine work", () => {
    const assessment = assessAutonomy(
      createContext(
        "Corrige el componente y ejecuta las pruebas."
      )
    );

    expect(assessment.defaultAction).toBe("proceed");
    expect(assessment.potentialHumanGates).toEqual([]);
  });

  it("detects credentials without blocking safe work", () => {
    const assessment = assessAutonomy(
      createContext(
        "Configura la API key y termina la integración."
      )
    );

    expect(assessment.defaultAction).toBe("proceed");
    expect(assessment.potentialHumanGates).toContain(
      "credentials_or_identity"
    );
  });

  it("detects financial and external commitments", () => {
    const assessment = assessAutonomy(
      createContext(
        "Paga la suscripción y publica la aplicación."
      )
    );

    expect(assessment.potentialHumanGates).toEqual(
      expect.arrayContaining([
        "financial_commitment",
        "external_commitment",
      ])
    );
  });

  it("supports multilingual human-gate signals", () => {
    const assessment = assessAutonomy(
      createContext(
        "Publier le produit après le paiement."
      )
    );

    expect(assessment.potentialHumanGates).toEqual(
      expect.arrayContaining([
        "financial_commitment",
        "external_commitment",
      ])
    );
  });
});
