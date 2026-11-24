import { z } from "zod";

import { APP_ROLES } from "./roles";

// Messages are i18n keys (see @sarhad/i18n "validation" namespace) so every
// app can show them in Arabic or English.

export const PASSWORD_MIN_LENGTH = 8;

export const emailSchema = z.string().trim().toLowerCase().email("invalidEmail");

/** Matches supabase/config.toml: minimum 8, letters and digits. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, "passwordTooShort")
  .regex(/[A-Za-z]/, "passwordNeedsLetter")
  .regex(/[0-9]/, "passwordNeedsDigit");

/** Kuwait mobile numbers: 8 digits starting with 4, 5, 6 or 9, optional +965. */
export const kuwaitPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^(\+965|00965)?[4569]\d{7}$/.test(v), "invalidPhone")
  .transform((v) => `+965${v.slice(-8)}`);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "required"),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "nameTooShort").max(80),
  email: emailSchema,
  phone: z.union([kuwaitPhoneSchema, z.literal("").transform(() => undefined)]).optional(),
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "passwordsDoNotMatch",
    path: ["confirmPassword"],
  });

export const assignRoleSchema = z
  .object({
    email: emailSchema,
    role: z.enum(APP_ROLES),
    branchId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((d) => d.role === "owner" || d.role === "admin" || !!d.branchId, {
    message: "branchRequired",
    path: ["branchId"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

/** First error message per field, for showing next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
