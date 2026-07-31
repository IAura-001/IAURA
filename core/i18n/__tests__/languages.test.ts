import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  getLanguageDefinition,
  isSupportedLocale,
  normalizeLocale,
} from "../languages";

describe("IAURA languages", () => {
  it("recognizes every supported launch locale", () => {
    expect(isSupportedLocale("es-419")).toBe(
      true
    );
    expect(isSupportedLocale("en-US")).toBe(
      true
    );
    expect(isSupportedLocale("pt-BR")).toBe(
      true
    );
    expect(isSupportedLocale("fr-FR")).toBe(
      true
    );
  });

  it("migrates compatible locale variants", () => {
    expect(normalizeLocale("es-ES")).toBe(
      "es-419"
    );
    expect(normalizeLocale("en")).toBe("en-US");
    expect(normalizeLocale("pt-PT")).toBe(
      "pt-BR"
    );
  });

  it("falls back safely for unknown values", () => {
    expect(normalizeLocale("unknown")).toBe(
      DEFAULT_LOCALE
    );
    expect(normalizeLocale(undefined)).toBe(
      DEFAULT_LOCALE
    );
  });

  it("provides the language name used by IAURA", () => {
    expect(
      getLanguageDefinition("fr-FR")
        .englishName
    ).toBe("French");
  });
});
