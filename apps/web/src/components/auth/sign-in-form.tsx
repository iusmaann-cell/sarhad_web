"use client";

import { Alert } from "@sarhad/ui";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { signIn } from "@/app/[locale]/(auth)/actions";
import { Link } from "@/i18n/navigation";
import { initialFormState } from "@/lib/form-state";

import { FormMessage, SubmitButton, TextField } from "./form-bits";

export function SignInForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(signIn, initialFormState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      {linkError && state.status === "idle" ? (
        <Alert variant="destructive">{t("linkInvalid")}</Alert>
      ) : null}
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
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
        name="password"
        type="password"
        autoComplete="current-password"
        dir="ltr"
        label={t("password")}
        state={state}
        required
      />
      <Link href="/forgot-password" className="text-sm text-primary hover:underline">
        {t("forgotPassword")}
      </Link>
      <SubmitButton>{t("signIn")}</SubmitButton>
    </form>
  );
}
