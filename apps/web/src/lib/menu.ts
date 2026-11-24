import "server-only";

import type { BranchMenu, OpeningHours, Tables } from "@sarhad/core";

import { hasSupabaseEnv } from "./env";
import { createClient } from "./supabase/server";

export type PublicBranch = Pick<
  Tables<"branches">,
  | "id"
  | "slug"
  | "name_en"
  | "name_ar"
  | "address_en"
  | "address_ar"
  | "phone"
  | "whatsapp"
  | "latitude"
  | "longitude"
  | "accepts_delivery"
  | "accepts_pickup"
  | "accepting_orders"
  | "timezone"
> & { opening_hours: OpeningHours };

export async function getBranches(): Promise<PublicBranch[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select(
      "id, slug, name_en, name_ar, address_en, address_ar, phone, whatsapp, latitude, longitude, accepts_delivery, accepts_pickup, accepting_orders, timezone, opening_hours",
    )
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []).map((b) => ({
    ...b,
    opening_hours: (b.opening_hours ?? {}) as OpeningHours,
  }));
}

export async function getBranchMenu(branchId: string): Promise<BranchMenu> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_branch_menu", { p_branch_id: branchId });
  return (data ?? []) as unknown as BranchMenu;
}

export function imageBase(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}
