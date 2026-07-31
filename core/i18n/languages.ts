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

interface ProfileMessages {
  eyebrow: string;
  title: string;
  description: string;
  namePlaceholder: string;
  save: string;
  languageLabel: string;
  languageHint: string;
}

export const PROFILE_MESSAGES: Record<
  SupportedLocale,
  ProfileMessages
> = {
  "es-419": {
    eyebrow: "PERFIL",
    title: "Personaliza IAURA",
    description:
      "Elige cómo debe llamarte IAURA y el idioma de toda tu experiencia.",
    namePlaceholder: "Tu nombre",
    save: "Guardar perfil",
    languageLabel: "Idioma de IAURA",
    languageHint:
      "También controla las respuestas, el micrófono y la voz de Aura Prime.",
  },
  "en-US": {
    eyebrow: "USER PROFILE",
    title: "Personalize IAURA",
    description:
      "Choose what IAURA should call you and the language of your experience.",
    namePlaceholder: "Your name",
    save: "Save profile",
    languageLabel: "IAURA language",
    languageHint:
      "This also controls responses, speech recognition and Aura Prime.",
  },
  "pt-BR": {
    eyebrow: "PERFIL",
    title: "Personalize a IAURA",
    description:
      "Escolha como a IAURA deve chamar você e o idioma da sua experiência.",
    namePlaceholder: "Seu nome",
    save: "Salvar perfil",
    languageLabel: "Idioma da IAURA",
    languageHint:
      "Também controla as respostas, o microfone e a voz Aura Prime.",
  },
  "fr-FR": {
    eyebrow: "PROFIL",
    title: "Personnalisez IAURA",
    description:
      "Choisissez comment IAURA doit vous appeler et la langue de votre expérience.",
    namePlaceholder: "Votre nom",
    save: "Enregistrer",
    languageLabel: "Langue d’IAURA",
    languageHint:
      "Elle contrôle aussi les réponses, le micro et la voix Aura Prime.",
  },
};
