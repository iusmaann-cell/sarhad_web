import "server-only";

import { hasSupabaseEnv } from "./env";
import { createClient } from "./supabase/server";

/** The signed-in user, or null. Safe to call when Supabase is not configured. */
export async function getUser() {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
