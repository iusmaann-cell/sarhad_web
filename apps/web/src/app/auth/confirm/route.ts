import { isLocale, LOCALE_COOKIE } from "@sarhad/i18n";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Landing page for links in Supabase emails (sign-up confirmation, password
 * reset). Verifies the one-time token, which signs the user in, then sends
 * them to the right page in their language.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const prefix = isLocale(cookieLocale) && cookieLocale === "en" ? "/en" : "";
  const to = (path: string) => NextResponse.redirect(new URL(`${prefix}${path}`, request.url));

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return to(type === "recovery" ? "/reset-password" : "/account");
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return to("/account");
  }

  return to("/sign-in?error=link");
}
