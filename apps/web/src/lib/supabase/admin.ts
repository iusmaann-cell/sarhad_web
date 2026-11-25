import "server-only";

import type { Database } from "@sarhad/core";
import { createClient } from "@supabase/supabase-js";

import { supabaseEnv } from "../env";

/**
 * Supabase client with the service role ("secret") key. It bypasses Row Level
 * Security, so it is used only on the server, only for payments: reading
 * gateway keys and recording results the gateway has confirmed.
 */
export function createAdminClient() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set: online payments are off.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasAdminKey(): boolean {
  return !!process.env.SUPABASE_SECRET_KEY;
}
