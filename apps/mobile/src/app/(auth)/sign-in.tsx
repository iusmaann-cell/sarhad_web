import { signInSchema } from "@sarhad/core";
import { router } from "expo-router";
import { useState } from "react";

import { Button, Notice, Screen, TextField, Title } from "@/components/ui";
import { authErrorKey } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { useForm } from "@/lib/use-form";

export default function SignIn() {
  const { t } = useI18n();
  const form = useForm(signInSchema, { email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function submit() {
    const data = form.validate();
    if (!data) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword(data);
    setLoading(false);
    if (error) return setError(authErrorKey(error));
    router.replace("/");
  }

  const err = (k: string) => (form.errors[k] ? t(form.errors[k]) : undefined);

  return (
    <Screen>
      <Title>{t("auth.signInTitle")}</Title>
      {error ? <Notice kind="error">{t(error)}</Notice> : null}
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
        label={t("auth.password")}
        value={form.values.password}
        onChangeText={form.set("password")}
        error={err("password")}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        ltr
        onSubmitEditing={submit}
      />
      <Button title={t("auth.signIn")} onPress={submit} loading={loading} />
      <Button
        title={t("auth.forgotPassword")}
        variant="link"
        onPress={() => router.push("/forgot-password")}
      />
      <Button
        title={`${t("auth.noAccount")} ${t("auth.signUp")}`}
        variant="link"
        onPress={() => router.replace("/sign-up")}
      />
    </Screen>
  );
}
