"use server";

import {
  cartToOrderItems,
  checkoutSchema,
  fieldErrors,
  orderErrorCode,
  type Cart,
  type OrderErrorCode,
} from "@sarhad/core";

import { createClient } from "@/lib/supabase/server";

export type PlaceOrderResult =
  | { ok: true; id: string; orderNumber: number }
  | { ok: false; error?: OrderErrorCode; fieldErrors?: Record<string, string> };

export async function placeOrder(input: {
  clientRef: string;
  cart: Cart;
  checkout: unknown;
  saveAddress: boolean;
}): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input.checkout);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const c = parsed.data;
  if (!input.cart.branchId || input.cart.lines.length === 0) {
    return { ok: false, error: "cart_empty" };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "sign_in_required" };

  const { data, error } = await supabase.rpc("place_order", {
    p_order: {
      client_ref: input.clientRef,
      branch_id: input.cart.branchId,
      type: c.type,
      customer_name: c.name,
      customer_phone: c.phone,
      notes: c.notes ?? null,
      address: c.type === "delivery" ? c.address : null,
      items: cartToOrderItems(input.cart),
    },
  });
  if (error || !data) return { ok: false, error: orderErrorCode(error?.message) };

  if (c.type === "delivery" && input.saveAddress) {
    const a = c.address;
    const { data: same } = await supabase
      .from("customer_addresses")
      .select("id")
      .eq("area", a.area)
      .eq("block", a.block)
      .eq("street", a.street)
      .eq("building", a.building)
      .limit(1);
    if (same?.length)
      return {
        ok: true,
        id: (data as { id: string }).id,
        orderNumber: (data as { order_number: number }).order_number,
      };
    // Saving the address is a convenience: an error here must not fail the order.
    await supabase.from("customer_addresses").insert({
      area: a.area,
      block: a.block,
      street: a.street,
      avenue: a.avenue ?? null,
      building: a.building,
      floor: a.floor ?? null,
      apartment: a.apartment ?? null,
      notes: a.notes ?? null,
      latitude: a.latitude,
      longitude: a.longitude,
    });
  }

  const result = data as { id: string; order_number: number };
  return { ok: true, id: result.id, orderNumber: result.order_number };
}
