import "server-only";

import { createAdminClient } from "../supabase/admin";
import {
  allowTestGateway,
  GatewayError,
  myFatoorah,
  tap,
  testGateway,
  type Gateway,
} from "./gateways";

export type StartPaymentError =
  "not_found" | "already_paid" | "not_payable" | "gateway_unavailable" | "gateway_error";

type Provider = { id: string; kind: string; is_live: boolean; is_active: boolean };

async function gatewayFor(provider: Provider, origin: string): Promise<Gateway | null> {
  const admin = createAdminClient();
  if (provider.kind === "test") {
    if (!allowTestGateway()) return null;
    return testGateway(origin, async (paymentId) => {
      const { data } = await admin.from("payments").select("raw").eq("id", paymentId).maybeSingle();
      const raw = (data?.raw ?? {}) as { test_outcome?: string };
      return raw.test_outcome ?? null;
    });
  }
  const { data: secret } = await admin
    .from("payment_provider_secrets")
    .select("api_key")
    .eq("provider_id", provider.id)
    .maybeSingle();
  const apiKey = secret?.api_key;
  if (!apiKey) return null;
  const config = { apiKey, isLive: provider.is_live };
  if (provider.kind === "myfatoorah") return myFatoorah(config);
  if (provider.kind === "tap") return tap(config);
  return null;
}

/**
 * Starts (or restarts) the online payment of a customer's order and returns
 * the gateway page to send them to. `customerId` must be the signed-in user.
 */
export async function startPayment(input: {
  orderId: string;
  customerId: string;
  origin: string;
  locale: "ar" | "en";
  /** "app": the customer comes back to a page that sends them to the mobile app. */
  from?: "web" | "app";
}): Promise<{ ok: true; url: string } | { ok: false; error: StartPaymentError }> {
  const admin = createAdminClient();
  await admin.rpc("expire_unpaid_orders");
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, order_number, customer_id, status, payment_method, payment_status, payment_provider_id, total_fils, customer_name, customer_phone",
    )
    .eq("id", input.orderId)
    .maybeSingle();
  if (!order || order.customer_id !== input.customerId) return { ok: false, error: "not_found" };
  if (order.payment_status === "paid") return { ok: false, error: "already_paid" };
  if (
    order.payment_method !== "online" ||
    order.status !== "pending" ||
    !order.payment_provider_id
  ) {
    return { ok: false, error: "not_payable" };
  }

  const { data: provider } = await admin
    .from("payment_providers")
    .select("id, kind, is_live, is_active")
    .eq("id", order.payment_provider_id)
    .maybeSingle();
  const gateway = provider?.is_active ? await gatewayFor(provider, input.origin) : null;
  if (!provider || !gateway) return { ok: false, error: "gateway_unavailable" };

  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      order_id: order.id,
      provider_id: provider.id,
      provider_kind: provider.kind,
      amount_fils: order.total_fils,
    })
    .select("id")
    .single();
  if (error || !payment) return { ok: false, error: "gateway_error" };

  const returnUrl = `${input.origin}/api/payments/return?payment=${payment.id}${
    input.from === "app" ? "&app=1" : ""
  }`;
  try {
    const created = await gateway.create({
      paymentId: payment.id,
      orderNumber: order.order_number,
      amountFils: order.total_fils,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      locale: input.locale,
      returnUrl,
      webhookUrl: `${input.origin}/api/payments/webhook?payment=${payment.id}`,
    });
    await admin
      .from("payments")
      .update({ provider_ref: created.providerRef, raw: { return_url: returnUrl } })
      .eq("id", payment.id);
    return { ok: true, url: created.redirectUrl };
  } catch (e) {
    await admin.rpc("record_payment_result", {
      p_payment_id: payment.id,
      p_status: "failed",
      p_raw: { error: e instanceof GatewayError ? (e.details ?? e.message) : String(e) } as never,
    });
    console.error("payment start failed", e);
    return { ok: false, error: "gateway_error" };
  }
}

/**
 * Asks the gateway for the result of a payment and records it. Safe to call
 * many times (return page, webhook, retries).
 */
export async function confirmPayment(
  paymentId: string,
  origin: string,
): Promise<{ orderId: string; status: "paid" | "failed" | "pending" | "cancelled" } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return null;
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, order_id, provider_id, provider_ref, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return null;
  if (payment.status === "paid") return { orderId: payment.order_id, status: "paid" };
  if (!payment.provider_ref || !payment.provider_id) {
    return { orderId: payment.order_id, status: "failed" };
  }

  const { data: provider } = await admin
    .from("payment_providers")
    .select("id, kind, is_live, is_active")
    .eq("id", payment.provider_id)
    .maybeSingle();
  // A disabled gateway can still confirm payments that were already started.
  const gateway = provider ? await gatewayFor({ ...provider, is_active: true }, origin) : null;
  if (!gateway) return { orderId: payment.order_id, status: "pending" };

  try {
    const result = await gateway.check(payment.provider_ref);
    if (result.status !== "pending") {
      const { data: recorded } = await admin.rpc("record_payment_result", {
        p_payment_id: payment.id,
        p_status: result.status,
        p_raw: result.raw as never,
      });
      return {
        orderId: payment.order_id,
        status: (recorded as "paid" | "failed" | "cancelled") ?? result.status,
      };
    }
    return { orderId: payment.order_id, status: "pending" };
  } catch (e) {
    console.error("payment check failed", e);
    return { orderId: payment.order_id, status: "pending" };
  }
}

/**
 * Test gateway only: store the button the customer pressed. Returns the URL to
 * send the customer back to, like a real gateway would.
 */
export async function setTestOutcome(
  paymentId: string,
  outcome: "paid" | "declined",
): Promise<string | null> {
  if (!allowTestGateway() || !/^[0-9a-f-]{36}$/i.test(paymentId)) return null;
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, provider_kind, status, raw")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.provider_kind !== "test" || payment.status !== "initiated") return null;
  const raw = (payment.raw ?? {}) as { return_url?: string };
  await admin
    .from("payments")
    .update({ raw: { ...raw, test_outcome: outcome } })
    .eq("id", paymentId);
  return raw.return_url ?? null;
}
