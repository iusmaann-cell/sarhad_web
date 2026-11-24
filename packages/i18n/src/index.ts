import ar from "./messages/ar.json";
import en from "./messages/en.json";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];

/** Arabic first: most Sarhad customers are in Kuwait. */
export const defaultLocale: Locale = "ar";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export type Messages = typeof en;

export const messages: Record<Locale, Messages> = { ar, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}

/** Pick the right column of a bilingual row, e.g. name_ar / name_en. */
export function localized<T extends Record<string, unknown>, K extends string>(
  row: T,
  field: K,
  locale: Locale,
): string {
  const value = row[`${field}_${locale}`] ?? row[`${field}_${otherLocale(locale)}`];
  return typeof value === "string" ? value : "";
}
