import type { Locale } from "@sarhad/i18n";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LegalPage } from "@/components/legal/legal-page";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "legal" });
  return { title: t("termsTitle") };
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  return <LegalPage locale={locale} doc="terms" />;
}
