"use server";

import { branchSchema, fieldErrors, toPointWkt } from "@sarhad/core";
import { revalidatePath } from "next/cache";

import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export async function saveBranch(id: string | null, input: unknown): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!id && !staff.isAdmin) return { ok: false, message: "notAllowed" };

  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const b = parsed.data;

  const row = {
    name_en: b.nameEn,
    name_ar: b.nameAr,
    slug: b.slug,
    address_en: b.addressEn,
    address_ar: b.addressAr,
    phone: b.phone,
    whatsapp: b.whatsapp,
    location: toPointWkt(b.latitude, b.longitude),
    is_active: b.isActive,
    accepts_delivery: b.acceptsDelivery,
    accepts_pickup: b.acceptsPickup,
    sort_order: b.sortOrder,
    opening_hours: b.openingHours,
  };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("branches").update(row).eq("id", id).select("id").maybeSingle()
    : await supabase.from("branches").insert(row).select("id").single();

  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { slug: "slugTaken" } };
    return { ok: false, message: dbErrorMessage(error) };
  }
  if (!data) return { ok: false, message: "notAllowed" };

  revalidatePath("/branches");
  return { ok: true, message: "branchSaved", id: data.id };
}
