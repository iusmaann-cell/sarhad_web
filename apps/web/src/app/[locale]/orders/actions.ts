"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function cancelOrder(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_order", { p_order_id: id });
  revalidatePath("/[locale]/orders/[id]", "page");
  return { ok: !error };
}
