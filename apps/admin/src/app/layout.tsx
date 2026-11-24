import { getDirection } from "@sarhad/i18n";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { arabic, latin } from "@/lib/fonts";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  const tc = await getTranslations("common");
  return {
    title: { default: `${t("title")} | ${tc("brand")}`, template: `%s | ${t("title")}` },
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`${latin.variable} ${arabic.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-muted/40">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
