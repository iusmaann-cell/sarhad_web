import "server-only";

import type { ZoneArea } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";

import { createClient } from "@/lib/supabase/server";

export type ZoneRow = {
  id: string;
  branch_id: string;
  name_en: string;
  name_ar: string;
  area_geojson: ZoneArea;
  fee_fils: number;
  min_order_fils: number;
  eta_minutes: number;
  color: string;
  is_active: boolean;
  delivery_areas?: {
    city_en: string;
    city_ar: string;
    name_en: string;
    name_ar: string;
    sort_order: number;
  }[];
};

const ZONE_FIELDS =
  "id, branch_id, name_en, name_ar, area_geojson, fee_fils, min_order_fils, eta_minutes, color, is_active";

/** Branches this staff member can see (RLS), with their pin. */
export async function loadBranches() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select("id, name_en, name_ar, latitude, longitude, accepts_delivery")
    .order("sort_order");
  return data ?? [];
}

export async function loadZones(branchId: string): Promise<ZoneRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_zones")
    .select(`${ZONE_FIELDS}, delivery_areas(city_en, city_ar, name_en, name_ar, sort_order)`)
    .eq("branch_id", branchId)
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as unknown as ZoneRow[];
}

export async function loadZone(id: string): Promise<ZoneRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_zones")
    .select(`${ZONE_FIELDS}, delivery_areas(city_en, city_ar, name_en, name_ar, sort_order)`)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as ZoneRow | null) ?? null;
}

/** A zone's named areas in the order the manager set, for the form. */
export function zoneAreaValues(z: ZoneRow) {
  return [...(z.delivery_areas ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => ({ cityEn: a.city_en, cityAr: a.city_ar, nameEn: a.name_en, nameAr: a.name_ar }));
}

export function toMapZone(z: ZoneRow, locale: Locale) {
  return { id: z.id, name: localized(z, "name", locale), color: z.color, area: z.area_geojson };
}
