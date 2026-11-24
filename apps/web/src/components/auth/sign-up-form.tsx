"use client";

import { Alert } from "@sarhad/ui";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { signUp } from "@/app/[locale]/(auth)/actions";
import { initialFormState } from "@/lib/form-state";

import { FormMessage, SubmitButton, TextField } from "./form-bits";

export function SignUpForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(signUp, initialFormState);

  if (state.status === "success") {
    return (
      <Alert variant="success">
        <p className="font-semibold">{t("checkEmailTitle")}</p>
        <p>{t("checkEmailBody", { email: state.values?.email ?? "" })}</p>
      </Alert>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField name="fullName" autoComplete="name" label={t("fullName")} state={state} required />
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        dir="ltr"
        label={t("email")}
        state={state}
        required
      />
      <TextField
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        dir="ltr"
        label={t("phone")}
        hint={t("phoneHint")}
        state={state}
      />
      <TextField
        name="password"
        type="password"
        autoComplete="new-password"
        dir="ltr"
        label={t("password")}
        hint={t("passwordHint")}
        state={state}
        required
      />
      <SubmitButton>{t("signUp")}</SubmitButton>
    </form>
  );
}
