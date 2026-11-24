import { signUpSchema } from "@sarhad/core";
import { router } from "expo-router";
import { useState } from "react";

import { Button, Notice, Screen, TextField, Title } from "@/components/ui";
import { authErrorKey } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { SITE_URL, supabase } from "@/lib/supabase";
import { useForm } from "@/lib/use-form";

export default function SignUp() {
  const { t, locale } = useI18n();
  const form = useForm(signUpSchema, { fullName: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit() {
    const data = form.validate();
    if (!data) return;
    setLoading(true);
    setError(null);
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${SITE_URL}/auth/confirm`,
        data: { full_name: data.fullName, phone: data.phone ?? null, preferred_locale: locale },
      },
    });
    setLoading(false);
    if (error) return setError(authErrorKey(error));
    if (result.session) return router.replace("/");
    setSentTo(data.email);
  }

  if (sentTo) {
    return (
      <Screen>
        <Title>{t("auth.checkEmailTitle")}</Title>
        <Notice kind="success">{t("auth.checkEmailBody", { email: sentTo })}</Notice>
        <Button title={t("auth.signIn")} onPress={() => router.replace("/sign-in")} />
      </Screen>
    );
  }

  const err = (k: string) => (form.errors[k] ? t(form.errors[k]) : undefined);

  return (
    <Screen>
      <Title>{t("auth.signUpTitle")}</Title>
      {error ? <Notice kind="error">{t(error)}</Notice> : null}
      <TextField
        label={t("auth.fullName")}
        value={form.values.fullName}
        onChangeText={form.set("fullName")}
        error={err("fullName")}
        autoComplete="name"
        textContentType="name"
      />
      <TextField
        label={t("auth.email")}
        value={form.values.email}
        onChangeText={form.set("email")}
        error={err("email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        ltr
      />
      <TextField
        label={t("auth.phone")}
        hint={t("auth.phoneHint")}
        value={form.values.phone}
        onChangeText={form.set("phone")}
        error={err("phone")}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        ltr
      />
      <TextField
        label={t("auth.password")}
        hint={t("auth.passwordHint")}
        value={form.values.password}
        onChangeText={form.set("password")}
        error={err("password")}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        ltr
      />
      <Button title={t("auth.signUp")} onPress={submit} loading={loading} />
      <Button
        title={`${t("auth.haveAccount")} ${t("auth.signIn")}`}
        variant="link"
        onPress={() => router.replace("/sign-in")}
      />
    </Screen>
  );
}
