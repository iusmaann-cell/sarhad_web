import "server-only";

import type { ZoneArea } from "@sarhad/core";

import { hasSupabaseEnv } from "./env";
import { getBranches } from "./menu";
import { createClient } from "./supabase/server";

export type PublicZone = {
  id: string;
  branch_id: string;
  name_en: string;
  name_ar: string;
  color: string;
  area: ZoneArea;
};

/** Active delivery areas of open-to-delivery branches, for the map. */
export async function getDeliveryAreas(): Promise<PublicZone[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const [branches, { data }] = await Promise.all([
    getBranches(),
    supabase
      .from("delivery_zones")
      .select("id, branch_id, name_en, name_ar, color, area_geojson")
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  const delivering = new Set(branches.filter((b) => b.accepts_delivery).map((b) => b.id));
  return (data ?? [])
    .filter((z) => delivering.has(z.branch_id))
    .map(({ area_geojson, ...z }) => ({ ...z, area: area_geojson as unknown as ZoneArea }));
}
