"use server";

import { fieldErrors, forgotPasswordSchema, resetPasswordSchema, signInSchema } from "@sarhad/core";
import { isLocale, LOCALE_COOKIE } from "@sarhad/i18n";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { safeNext, type FormState } from "@/lib/form-state";
import { siteOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const values = { email: String(raw.email ?? "") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "invalidCredentials"
        : error.code === "email_not_confirmed"
          ? "emailNotConfirmed"
          : "genericError";
    return { status: "error", message, values };
  }
  redirect(safeNext(formData.get("next"), "/"));
}

export async function forgotPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: { email: String(formData.get("email") ?? "") },
    };
  }
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/confirm`,
  });
  return { status: "success", message: "resetEmailSent" };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "error", message: "linkInvalid" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", fieldErrors: { password: "passwordTooShort" } };
  return { status: "success", message: "passwordUpdated" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (isLocale(locale)) {
    (await cookies()).set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
}
