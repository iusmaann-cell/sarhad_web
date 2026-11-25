"use server";

import { fieldErrors, promoSchema } from "@sarhad/core";
import { revalidatePath } from "next/cache";

import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export async function savePromo(id: string | null, input: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const row = parsed.data;

  // RLS decides: admins any code, branch managers codes for their own branch.
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("promo_codes").update(row).eq("id", id).select("id").maybeSingle()
    : await supabase.from("promo_codes").insert(row).select("id").single();
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { code: "promoCodeTaken" } };
    return { ok: false, message: dbErrorMessage(error) };
  }
  if (!data) return { ok: false, message: "notAllowed" };
  revalidatePath("/promotions");
  return { ok: true, message: "promoSaved", id: data.id };
}

export async function deletePromo(id: string): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("promo_codes").delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: "notAllowed" };
  revalidatePath("/promotions");
  return { ok: true, message: "promoDeleted" };
}
