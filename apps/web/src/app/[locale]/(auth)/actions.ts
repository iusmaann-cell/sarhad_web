"use server";

import {
  fieldErrors,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@sarhad/core";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { safeNext, type FormState } from "@/lib/form-state";
import { siteOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

function authErrorKey(error: { code?: string; message: string }): string {
  if (error.code === "invalid_credentials") return "invalidCredentials";
  if (error.code === "email_not_confirmed") return "emailNotConfirmed";
  if (error.code === "weak_password") return "genericError";
  return "genericError";
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const values = { email: String(raw.email ?? "") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: authErrorKey(error), values };

  const locale = await getLocale();
  return redirect({ href: safeNext(formData.get("next")), locale });
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const values = {
    fullName: String(raw.fullName ?? ""),
    email: String(raw.email ?? ""),
    phone: String(raw.phone ?? ""),
  };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

  const locale = await getLocale();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
      data: {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone ?? null,
        preferred_locale: locale,
      },
    },
  });
  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "passwordTooShort" }, values };
    }
    return { status: "error", message: authErrorKey(error), values };
  }

  // Email confirmation turned off: already signed in.
  if (data.session) redirect({ href: "/account", locale });

  return { status: "success", values: { email: parsed.data.email } };
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
  // Same answer whether or not the account exists, so emails cannot be probed.
  return { status: "success", message: "resetEmailSent" };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { status: "error", message: "linkInvalid" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password" || error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "passwordTooShort" } };
    }
    return { status: "error", message: authErrorKey(error) };
  }
  return { status: "success", message: "passwordUpdated" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect({ href: "/", locale });
}
