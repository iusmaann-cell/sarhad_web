"use client";

import { Alert, Button } from "@sarhad/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { forgotPassword, resetPassword, signIn } from "@/app/actions";
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

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const ta = useTranslations("admin");
  const [state, action] = useActionState(resetPassword, initialFormState);
  if (state.status === "success") {
    return (
      <div className="grid gap-4">
        <FormMessage state={state} />
        <Button asChild size="lg">
          <Link href="/">{ta("dashboard")}</Link>
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
