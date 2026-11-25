"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { siteOrigin } from "@/lib/origin";
import { startPayment, type StartPaymentError } from "@/lib/payments/service";
import { createClient } from "@/lib/supabase/server";

export async function cancelOrder(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_order", { p_order_id: id });
  revalidatePath("/[locale]/orders/[id]", "page");
  return { ok: !error };
}

/** Sends the customer to the gateway's payment page for an online order. */
export async function payOrder(
  id: string,
): Promise<{ error: StartPaymentError | "sign_in_required" }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "sign_in_required" };
  const result = await startPayment({
    orderId: id,
    customerId: auth.user.id,
    origin: await siteOrigin(),
    locale: (await getLocale()) === "en" ? "en" : "ar",
  });
  if (!result.ok) {
    revalidatePath("/[locale]/orders/[id]", "page");
    return { error: result.error };
  }
  redirect(result.url);
}
