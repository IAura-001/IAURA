"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "./languages";
import {
  translate,
  type MessageKey,
  type MessageParams,
} from "./messages";

interface I18nContextValue {
  locale: SupportedLocale;
  t: (
    key: MessageKey,
    params?: MessageParams
  ) => string;
}

const I18nContext =
  createContext<I18nContextValue>({
    locale: DEFAULT_LOCALE,
    t: (key, params) =>
      translate(DEFAULT_LOCALE, key, params),
  });

export function I18nProvider({
  locale,
  children,
}: {
  locale: SupportedLocale;
  children: ReactNode;
}) {
  const t = useCallback(
    (
      key: MessageKey,
      params?: MessageParams
    ) => translate(locale, key, params),
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      t,
    }),
    [locale, t]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
