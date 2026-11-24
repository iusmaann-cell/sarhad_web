import { defaultLocale, isLocale, LOCALE_COOKIE, messages } from "@sarhad/i18n";
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

// The back office has no locale in the URL: the choice is kept in a cookie.
export default getRequestConfig(async () => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(value) ? value : defaultLocale;
  return { locale, messages: messages[locale], timeZone: "Asia/Kuwait" };
});
