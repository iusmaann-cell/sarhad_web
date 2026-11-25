import "server-only";

import { isOpenAt, type DeliveryAreaOption } from "@sarhad/core";
import { cookies } from "next/headers";
import { cache } from "react";

import { hasSupabaseEnv } from "./env";
import { getBranches } from "./menu";
import {
  decodeOrderStart,
  ORDER_START_COOKIE,
  type OrderStart,
  type StartBranch,
} from "./order-start-shared";
import { createClient } from "./supabase/server";

/** Areas customers can order delivery to, one row per area, grouped later by city. */
export const getAreaOptions = cache(async (): Promise<DeliveryAreaOption[]> => {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_delivery_areas");
  return data ?? [];
});

/** Branches customers can pick up from. */
export const getPickupBranches = cache(async (): Promise<StartBranch[]> => {
  const now = new Date();
  return (await getBranches())
    .filter((b) => b.accepts_pickup)
    .map((b) => ({
      id: b.id,
      slug: b.slug,
      name_en: b.name_en,
      name_ar: b.name_ar,
      address_en: b.address_en,
      address_ar: b.address_ar,
      open: b.accepting_orders && isOpenAt(b.opening_hours, now, b.timezone),
    }));
});

/** Everything the delivery or pickup chooser needs, plus the visitor's saved choice. */
export const getOrderStart = cache(async () => {
  const [areas, branches, jar] = await Promise.all([
    getAreaOptions(),
    getPickupBranches(),
    cookies(),
  ]);
  const start: OrderStart | null = decodeOrderStart(
    jar.get(ORDER_START_COOKIE)?.value,
    areas,
    branches,
  );
  return { areas, branches, start };
});
