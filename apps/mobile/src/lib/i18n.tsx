import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  defaultLocale,
  getDirection,
  isLocale,
  messages,
  type Locale,
  type Messages,
} from "@sarhad/i18n";
import { getLocales } from "expo-localization";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { I18nManager } from "react-native";

const STORAGE_KEY = "sarhad.locale";

// Dotted keys of the shared message files, e.g. "auth.signIn".
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Messages>;

type I18n = {
  locale: Locale;
  isRTL: boolean;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18n | null>(null);

function lookup(locale: Locale, key: string): string {
  let node: unknown = messages[locale];
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === "string" ? node : key;
}

function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return isLocale(code) ? code : defaultLocale;
}

// The app flips layout with the `direction` style on the root view, so the
// language can change instantly without restarting the app.
I18nManager.allowRTL(true);
I18nManager.forceRTL(false);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (isLocale(saved)) setLocaleState(saved);
      })
      .catch(() => {});
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<I18n>(
    () => ({
      locale,
      isRTL: getDirection(locale) === "rtl",
      setLocale,
      t: (key, values) =>
        lookup(locale, key).replace(/\{(\w+)\}/g, (m, name: string) => String(values?.[name] ?? m)),
    }),
    [locale, setLocale],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18n {
  const ctx = use(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
