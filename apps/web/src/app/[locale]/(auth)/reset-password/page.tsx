import type { Locale } from "@sarhad/i18n";
import { Alert, Button } from "@sarhad/ui";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "auth" });
  return { title: t("resetTitle") };
}

// Reached from the password reset email via /auth/confirm, which signs the user in.
export default async function ResetPasswordPage({ params }: PageProps<"/[locale]/reset-password">) {
  setRequestLocale((await params).locale as Locale);
  const [t, user] = await Promise.all([getTranslations("auth"), getUser()]);

  return (
    <AuthCard title={t("resetTitle")}>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="grid gap-4">
          <Alert variant="destructive">{t("linkInvalid")}</Alert>
          <Button asChild variant="outline">
            <Link href="/forgot-password">{t("sendResetLink")}</Link>
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
