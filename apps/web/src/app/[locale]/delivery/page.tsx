import type { Locale } from "@sarhad/i18n";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DeliveryChecker } from "@/components/delivery/delivery-checker";
import { getDeliveryAreas } from "@/lib/delivery";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/delivery">): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as Locale,
    namespace: "delivery",
  });
  return { title: t("title") };
}

export default async function DeliveryPage({ params }: PageProps<"/[locale]/delivery">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, zones] = await Promise.all([getTranslations("delivery"), getDeliveryAreas()]);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("intro")}</p>
      </div>
      <DeliveryChecker zones={zones} />
    </div>
  );
}
