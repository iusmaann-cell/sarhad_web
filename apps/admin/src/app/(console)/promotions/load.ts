import "server-only";

import { canManageBranch } from "@sarhad/core";

import type { StaffContext } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import type { PromoBranch } from "./promo-form";

/** Branches this person may make promo codes for. */
export async function promoBranches(staff: StaffContext): Promise<PromoBranch[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select("id, name_en, name_ar")
    .order("sort_order");
  return (data ?? []).filter((b) => staff.isAdmin || canManageBranch(staff.roles, b.id));
}

export const EMPTY_PROMO = {
  code: "",
  nameEn: "",
  nameAr: "",
  kind: "percent" as const,
  value: "",
  minSubtotal: "",
  maxDiscount: "",
  branchId: "",
  startsOn: "",
  endsOn: "",
  maxUses: "",
  maxUsesPerCustomer: "1",
  firstOrderOnly: false,
  isActive: true,
};
