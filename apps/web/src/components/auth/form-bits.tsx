"use client";

import { Alert, Button, Field, Input } from "@sarhad/ui";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import type { FormState } from "@/lib/form-state";

type AuthKey = Parameters<ReturnType<typeof useTranslations<"auth">>>[0];
type ValidationKey = Parameters<ReturnType<typeof useTranslations<"validation">>>[0];

export function FormMessage({ state }: { state: FormState }) {
  const t = useTranslations("auth");
  if (!state.message) return null;
  return (
    <Alert variant={state.status === "success" ? "success" : "destructive"}>
      {t(state.message as AuthKey)}
    </Alert>
  );
}

export function TextField({
  name,
  label,
  hint,
  state,
  ...props
}: { name: string; label: string; hint?: string; state: FormState } & ComponentProps<"input">) {
  const tv = useTranslations("validation");
  const errorKey = state.fieldErrors?.[name];
  const id = `field-${name}`;
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={errorKey ? tv(errorKey as ValidationKey) : undefined}
    >
      <Input
        id={id}
        name={name}
        defaultValue={state.values?.[name]}
        aria-invalid={!!errorKey}
        aria-describedby={errorKey ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
    </Field>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  const t = useTranslations("common");
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? t("loading") : children}
    </Button>
  );
}
