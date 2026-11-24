import { NextResponse, type NextRequest } from "next/server";

import { refreshSession } from "./lib/supabase/proxy";

// Pages anyone can open. Everything else needs a signed-in user; the console
// layout then checks for a staff role.
const PUBLIC = ["/login", "/forgot-password", "/reset-password"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const claims = await refreshSession(request, response);

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));
  if (!claims && !isPublic) {
    const url = new URL("/login", request.url);
    if (path !== "/") url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
