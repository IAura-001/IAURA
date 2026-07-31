export const SUPPORTED_LOCALES = [
  "es-419",
  "en-US",
  "pt-BR",
  "fr-FR",
] as const;

export type SupportedLocale =
  (typeof SUPPORTED_LOCALES)[number];

export interface LanguageDefinition {
  locale: SupportedLocale;
  code: "es" | "en" | "pt" | "fr";
  nativeName: string;
  englishName: string;
}

export const DEFAULT_LOCALE: SupportedLocale =
  "es-419";

export const LANGUAGE_DEFINITIONS: readonly LanguageDefinition[] =
  [
    {
      locale: "es-419",
      code: "es",
      nativeName: "Español latinoamericano",
      englishName: "Latin American Spanish",
    },
    {
      locale: "en-US",
      code: "en",
      nativeName: "English (United States)",
      englishName: "American English",
    },
    {
      locale: "pt-BR",
      code: "pt",
      nativeName: "Português (Brasil)",
      englishName: "Brazilian Portuguese",
    },
    {
      locale: "fr-FR",
      code: "fr",
      nativeName: "Français (France)",
      englishName: "French",
    },
  ];

export function isSupportedLocale(
  value: unknown
): value is SupportedLocale {
  return (
    typeof value === "string" &&
    SUPPORTED_LOCALES.some(
      (locale) => locale === value
    )
  );
}

export function normalizeLocale(
  value: unknown
): SupportedLocale {
  if (isSupportedLocale(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return DEFAULT_LOCALE;
  }

  const normalizedValue = value
    .trim()
    .toLowerCase();
  const languageCode =
    normalizedValue.split("-")[0];

  return (
    LANGUAGE_DEFINITIONS.find(
      (language) =>
        language.code === languageCode
    )?.locale ?? DEFAULT_LOCALE
  );
}

export function getLanguageDefinition(
  locale: SupportedLocale
): LanguageDefinition {
  return (
    LANGUAGE_DEFINITIONS.find(
      (language) => language.locale === locale
    ) ?? LANGUAGE_DEFINITIONS[0]
  );
}
