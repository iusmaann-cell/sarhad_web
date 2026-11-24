"use client";

import { Button } from "@sarhad/ui";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { resetPassword } from "@/app/[locale]/(auth)/actions";
import { Link } from "@/i18n/navigation";
import { initialFormState } from "@/lib/form-state";

import { FormMessage, SubmitButton, TextField } from "./form-bits";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const tn = useTranslations("nav");
  const [state, action] = useActionState(resetPassword, initialFormState);

  if (state.status === "success") {
    return (
      <div className="grid gap-4">
        <FormMessage state={state} />
        <Button asChild size="lg">
          <Link href="/account">{tn("account")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
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
      <TextField
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        dir="ltr"
        label={t("confirmPassword")}
        state={state}
        required
      />
      <SubmitButton>{t("updatePassword")}</SubmitButton>
    </form>
  );
}
