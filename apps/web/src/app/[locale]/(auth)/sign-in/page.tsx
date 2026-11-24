import type { Locale } from "@sarhad/i18n";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Link } from "@/i18n/navigation";
import { safeNext } from "@/lib/form-state";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "nav" });
  return { title: t("signIn") };
}

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const sp = await searchParams;
  const t = await getTranslations("auth");

  return (
    <AuthCard
      title={t("signInTitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/sign-up" className="font-medium text-primary hover:underline">
            {t("signUp")}
          </Link>
        </>
      }
    >
      <SignInForm
        next={safeNext(typeof sp.next === "string" ? sp.next : undefined)}
        linkError={sp.error === "link"}
      />
    </AuthCard>
  );
}
