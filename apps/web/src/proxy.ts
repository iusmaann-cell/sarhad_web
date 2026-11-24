import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { refreshSession } from "./lib/supabase/proxy";

const handleI18n = createIntlMiddleware(routing);

// Pages that need a signed-in customer (without the locale prefix).
const PROTECTED = ["/account", "/checkout", "/orders"];

export async function proxy(request: NextRequest) {
  const response = handleI18n(request);

  // Redirects from next-intl (e.g. adding a locale) need no session work.
  if (response.headers.get("location")) return response;

  const claims = await refreshSession(request, response);

  const path = request.nextUrl.pathname.replace(/^\/(en|ar)(?=\/|$)/, "") || "/";
  if (!claims && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const prefix = request.nextUrl.pathname.startsWith("/en") ? "/en" : "";
    const url = new URL(`${prefix}/sign-in`, request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except API/auth routes, Next internals and files with an extension.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
