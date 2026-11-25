"use server";

import { createClient } from "@/lib/supabase/server";

export type DeleteAccountError = "staff_account" | "open_orders" | "unknown";

/** Deletes the signed-in customer's account, then signs them out. */
export async function deleteAccount(): Promise<
  { ok: true } | { ok: false; error: DeleteAccountError }
> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    const code = error.message as DeleteAccountError;
    return {
      ok: false,
      error: code === "staff_account" || code === "open_orders" ? code : "unknown",
    };
  }
  await supabase.auth.signOut();
  return { ok: true };
}
