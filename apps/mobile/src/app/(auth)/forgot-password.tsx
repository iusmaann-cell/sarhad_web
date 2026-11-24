import { forgotPasswordSchema } from "@sarhad/core";
import { useState } from "react";

import { AppText, Button, Notice, Screen, TextField, Title } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { SITE_URL, supabase } from "@/lib/supabase";
import { useForm } from "@/lib/use-form";

// The reset link opens the website, where the new password is chosen. The app
// then signs in with it. One reset page for every platform keeps this simple.
export default function ForgotPassword() {
  const { t } = useI18n();
  const form = useForm(forgotPasswordSchema, { email: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const data = form.validate();
    if (!data) return;
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${SITE_URL}/auth/confirm`,
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <Screen>
      <Title>{t("auth.forgotTitle")}</Title>
      {sent ? (
        <Notice kind="success">{t("auth.resetEmailSent")}</Notice>
      ) : (
        <>
          <AppText muted>{t("auth.forgotBody")}</AppText>
          <TextField
            label={t("auth.email")}
            value={form.values.email}
            onChangeText={form.set("email")}
            error={form.errors.email ? t(form.errors.email) : undefined}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            ltr
            onSubmitEditing={submit}
          />
          <Button title={t("auth.sendResetLink")} onPress={submit} loading={loading} />
        </>
      )}
    </Screen>
  );
}
