"use server";

import { canManageBranch, fieldErrors, zoneSchema } from "@sarhad/core";
import { revalidatePath } from "next/cache";

import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export async function saveZone(id: string | null, input: unknown): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const z = parsed.data;
  if (!canManageBranch(staff.roles, z.branchId)) return { ok: false, message: "notAllowed" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_delivery_zone", {
    p_zone: {
      id,
      branch_id: z.branchId,
      name_en: z.nameEn,
      name_ar: z.nameAr,
      area: z.area,
      fee_fils: z.fee,
      min_order_fils: z.minOrder,
      eta_minutes: z.etaMinutes,
      color: z.color,
      is_active: z.isActive,
      areas: z.areas.map((a) => ({
        city_en: a.cityEn,
        city_ar: a.cityAr,
        name_en: a.nameEn,
        name_ar: a.nameAr,
      })),
    },
  });
  if (error) {
    if (error.code === "22023") return { ok: false, fieldErrors: { area: "invalidArea" } };
    return { ok: false, message: dbErrorMessage(error) };
  }

  revalidatePath("/zones");
  return { ok: true, message: "zoneSaved", id: data };
}

export async function deleteZone(id: string): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_zones")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data) return { ok: false, message: "notAllowed" };
  revalidatePath("/zones");
  return { ok: true, message: "zoneDeleted" };
}
