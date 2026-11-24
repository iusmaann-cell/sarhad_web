"use server";

import type { DeliveryMatch } from "@sarhad/core";

import { createClient } from "@/lib/supabase/server";

const inRange = (n: unknown, max: number): n is number =>
  typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= max;

export type DeliveryCheck = { ok: true; matches: DeliveryMatch[] } | { ok: false };

/** Which delivery zones cover this point? Cheapest first. */
export async function checkDelivery(input: { lat: number; lng: number }): Promise<DeliveryCheck> {
  if (!inRange(input?.lat, 90) || !inRange(input?.lng, 180)) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_delivery_zone", {
    p_lat: input.lat,
    p_lng: input.lng,
  });
  if (error) return { ok: false };
  return { ok: true, matches: data ?? [] };
}
