import {
  describe,
  expect,
  it,
} from "vitest";

import {
  translate,
  type MessageKey,
} from "../messages";
import type { SupportedLocale } from "../languages";

const locales: SupportedLocale[] = [
  "es-419",
  "en-US",
  "pt-BR",
  "fr-FR",
];

describe("IAURA interface messages", () => {
  it.each(locales)(
    "translates the complete experience for %s",
    (locale) => {
      const keys: MessageKey[] = [
        "hero.intro",
        "assistant.question",
        "chat.placeholder",
        "chat.voiceOn",
        "chat.voiceOff",
        "dashboard.subtitle",
        "profile.languageHint",
        "missions.title",
        "brand.identityMission",
        "error.conversation",
      ];

      for (const key of keys) {
        expect(
          translate(locale, key).trim()
        ).not.toBe("");
      }
    }
  );

  it("interpolates dynamic values", () => {
    expect(
      translate(
        "es-419",
        "progress.completed",
        {
          completed: 2,
          total: 5,
        }
      )
    ).toBe(
      "2 de 5 misiones completadas"
    );

    expect(
      translate(
        "en-US",
        "hero.greeting",
        {
          name: "Diego",
        }
      )
    ).toBe("Hello, Diego.");
  });
});
