"use server";

import { fieldErrors, paymentProviderSchema } from "@sarhad/core";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export async function savePaymentProvider(
  id: string | null,
  input: unknown,
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.isAdmin) return { ok: false, message: "notAllowed" };
  const parsed = paymentProviderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const p = parsed.data;
  const supabase = await createClient();

  let hasKey = p.apiKey !== "";
  if (id && !hasKey) {
    const { data } = await supabase
      .from("payment_providers")
      .select("key_hint")
      .eq("id", id)
      .maybeSingle();
    hasKey = !!data?.key_hint;
  }
  if (p.isActive && p.kind !== "test" && !hasKey) {
    return { ok: false, fieldErrors: { apiKey: "paymentNeedsKey" }, message: "paymentNeedsKey" };
  }

  const row = {
    kind: p.kind,
    name_en: p.nameEn,
    name_ar: p.nameAr,
    is_active: p.isActive,
    is_live: p.isLive,
    sort_order: p.sortOrder,
  };
  const { data, error } = id
    ? await supabase.from("payment_providers").update(row).eq("id", id).select("id").maybeSingle()
    : await supabase.from("payment_providers").insert(row).select("id").single();
  if (error || !data) return { ok: false, message: "notAllowed" };

  if (p.apiKey) {
    const { error: keyError } = await supabase.rpc("set_payment_provider_key", {
      p_provider_id: data.id,
      p_api_key: p.apiKey,
    });
    if (keyError) return { ok: false, message: "notAllowed" };
  }
  revalidatePath("/settings");
  return { ok: true, message: "paymentSaved", id: data.id };
}

export async function deletePaymentProvider(id: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.isAdmin) return { ok: false, message: "notAllowed" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_providers")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "notAllowed" };
  revalidatePath("/settings");
  return { ok: true, message: "paymentDeleted" };
}
