import type { Locale } from "@sarhad/i18n";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CartView } from "@/components/cart/cart-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/cart">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "cart" });
  return { title: t("title") };
}

export default async function CartPage({ params }: PageProps<"/[locale]/cart">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("cart");
  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <CartView />
    </div>
  );
}
