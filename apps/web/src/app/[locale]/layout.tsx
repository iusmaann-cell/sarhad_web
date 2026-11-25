import { getDirection } from "@sarhad/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CartProvider } from "@/components/cart/cart-provider";
import { OrderStartProvider } from "@/components/order-start/order-start-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";
import { arabic, arabicDisplay, latin, script } from "@/lib/fonts";
import { getOrderStart } from "@/lib/order-start";

import "../globals.css";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    title: { default: t("brand"), template: `%s | ${t("brand")}` },
    description: t("tagline"),
    alternates: { languages: { ar: "/", en: "/en" } },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { areas, branches, start } = await getOrderStart();

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`${latin.variable} ${arabic.variable} ${script.variable} ${arabicDisplay.variable} h-full bg-black antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          <CartProvider>
            <OrderStartProvider initial={start} areas={areas} branches={branches}>
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </OrderStartProvider>
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
