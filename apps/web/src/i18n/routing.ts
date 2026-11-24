import { defaultLocale, LOCALE_COOKIE, locales } from "@sarhad/i18n";
import { defineRouting } from "next-intl/routing";

// "/" is Arabic, "/en/..." is English.
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeCookie: { name: LOCALE_COOKIE },
});
