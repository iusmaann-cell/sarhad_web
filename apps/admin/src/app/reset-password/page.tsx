import { Alert, Button } from "@sarhad/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/forms";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return (
    <AuthShell title={t("resetTitle")}>
      {data.user ? (
        <ResetPasswordForm />
      ) : (
        <div className="grid gap-4">
          <Alert variant="destructive">{t("linkInvalid")}</Alert>
          <Button asChild variant="outline">
            <Link href="/forgot-password">{t("sendResetLink")}</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
