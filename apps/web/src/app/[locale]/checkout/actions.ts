"use server";

import {
  cartToOrderItems,
  areaCheckoutSchema,
  fieldErrors,
  normalizePromoCode,
  orderErrorCode,
  type Cart,
  type OrderErrorCode,
} from "@sarhad/core";

import { createClient } from "@/lib/supabase/server";

export type PlaceOrderResult =
  | { ok: true; id: string; orderNumber: number; online: boolean }
  | { ok: false; error?: OrderErrorCode; fieldErrors?: Record<string, string> };

export async function placeOrder(input: {
  clientRef: string;
  cart: Cart;
  checkout: unknown;
  saveAddress: boolean;
  promoCode?: string | null;
  /** null: cash; otherwise the id of an online payment option. */
  providerId?: string | null;
}): Promise<PlaceOrderResult> {
  const parsed = areaCheckoutSchema.safeParse(input.checkout);
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
      // For delivery the area decides the branch on the server; this is only used for pickup.
      branch_id: input.cart.branchId,
      delivery_area_id: c.type === "delivery" ? c.areaId : null,
      type: c.type,
      customer_name: c.name,
      customer_phone: c.phone,
      notes: c.notes ?? null,
      address: c.type === "delivery" ? c.address : null,
      items: cartToOrderItems(input.cart),
      promo_code: input.promoCode ? normalizePromoCode(input.promoCode) : null,
      payment: input.providerId
        ? { method: "online", provider_id: input.providerId }
        : { method: "cash" },
    },
  });
  if (error || !data) return { ok: false, error: orderErrorCode(error?.message) };
  const placed = data as { id: string; order_number: number; payment_method: string };
  const done = {
    ok: true as const,
    id: placed.id,
    orderNumber: placed.order_number,
    online: placed.payment_method === "online",
  };

  if (c.type === "delivery" && input.saveAddress) {
    const a = c.address;
    // A saved address needs its map pin (the mobile app delivers by pin).
    if (a.latitude == null || a.longitude == null) return done;
    const { data: same } = await supabase
      .from("customer_addresses")
      .select("id")
      .eq("area", a.area)
      .eq("block", a.block)
      .eq("street", a.street)
      .eq("building", a.building)
      .limit(1);
    if (same?.length) return done;
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

  return done;
}

export type PromoQuote =
  | { ok: true; code: string; nameEn: string; nameAr: string; discountFils: number }
  | { ok: false; error: OrderErrorCode };

/** Checks a promo code for the checkout summary. place_order() checks it again. */
export async function quotePromo(input: {
  code: string;
  branchId: string;
  subtotalFils: number;
  deliveryFeeFils: number;
}): Promise<PromoQuote> {
  const code = normalizePromoCode(input.code);
  if (!code) return { ok: false, error: "promo_invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("promo_quote", {
    p_code: code,
    p_branch_id: input.branchId,
    p_subtotal_fils: Math.max(0, Math.round(input.subtotalFils)),
    p_delivery_fee_fils: Math.max(0, Math.round(input.deliveryFeeFils)),
  });
  if (error || !data) return { ok: false, error: orderErrorCode(error?.message) };
  const q = data as { code: string; name_en: string; name_ar: string; discount_fils: number };
  return {
    ok: true,
    code: q.code,
    nameEn: q.name_en,
    nameAr: q.name_ar,
    discountFils: q.discount_fils,
  };
}
