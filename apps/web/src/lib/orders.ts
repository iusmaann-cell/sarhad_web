import "server-only";

import type { OrderAddress, Tables } from "@sarhad/core";

import { createClient } from "./supabase/server";

export type OrderOption = { name_en: string; name_ar: string; price_delta_fils: number };
export type OrderLine = Omit<Tables<"order_items">, "options"> & { options: OrderOption[] };
export type OrderDetail = Omit<Tables<"orders">, "address"> & {
  address: OrderAddress | null;
  items: OrderLine[];
  events: Pick<Tables<"order_events">, "status" | "created_at">[];
  branch: Pick<Tables<"branches">, "name_en" | "name_ar" | "phone" | "slug"> | null;
};

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "*, items:order_items(*), events:order_events(status, created_at), branch:branches(name_en, name_ar, phone, slug)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const order = data as unknown as OrderDetail;
  order.items.sort((a, b) => a.sort_order - b.sort_order);
  order.events.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return order;
}

export async function getMyOrders() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, type, total_fils, created_at, branch:branches(name_en, name_ar)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as {
    id: string;
    order_number: number;
    status: Tables<"orders">["status"];
    type: Tables<"orders">["type"];
    total_fils: number;
    created_at: string;
    branch: { name_en: string; name_ar: string } | null;
  }[];
}
