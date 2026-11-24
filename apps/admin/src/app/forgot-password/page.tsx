import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forms";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthShell
      title={t("forgotTitle")}
      description={t("forgotBody")}
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("signIn")}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
