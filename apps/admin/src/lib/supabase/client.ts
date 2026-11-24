"use client";

import type { Database } from "@sarhad/core";
import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for Client Components (used for photo uploads). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
