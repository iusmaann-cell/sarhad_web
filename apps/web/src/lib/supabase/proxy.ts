import type { Database } from "@sarhad/core";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { hasSupabaseEnv, supabaseEnv } from "../env";

/**
 * Refreshes the Supabase session cookie on the given response.
 * Returns the signed-in user (or null) so the proxy can guard routes.
 */
export async function refreshSession(request: NextRequest, response: NextResponse) {
  if (!hasSupabaseEnv()) return null;
  const { url, key } = supabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
}
