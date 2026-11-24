"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { forgotPassword } from "@/app/[locale]/(auth)/actions";
import { initialFormState } from "@/lib/form-state";

import { FormMessage, SubmitButton, TextField } from "./form-bits";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(forgotPassword, initialFormState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      {state.status !== "success" ? (
        <>
          <TextField
            name="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            label={t("email")}
            state={state}
            required
          />
          <SubmitButton>{t("sendResetLink")}</SubmitButton>
        </>
      ) : null}
    </form>
  );
}
