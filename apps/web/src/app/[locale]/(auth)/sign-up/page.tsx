import type { Locale } from "@sarhad/i18n";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-up">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "nav" });
  return { title: t("signUp") };
}

export default async function SignUpPage({ params }: PageProps<"/[locale]/sign-up">) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("auth");

  return (
    <AuthCard
      title={t("signUpTitle")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href="/sign-in" className="font-medium text-primary hover:underline">
            {t("signIn")}
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
