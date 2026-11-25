import * as WebBrowser from "expo-web-browser";

import { SITE_URL, supabase } from "./supabase";

export type PaymentOption = { id: string; name_en: string; name_ar: string };

/** Online payment options, from the website (it knows which gateways can be used). */
export async function loadPaymentOptions(): Promise<PaymentOption[]> {
  try {
    const res = await fetch(`${SITE_URL}/api/payments/options`);
    if (!res.ok) return [];
    const body = (await res.json()) as { providers?: PaymentOption[] };
    return body.providers ?? [];
  } catch {
    return [];
  }
}

/**
 * Opens the gateway's payment page for an order in an in-app browser. Returns
 * an error code, or null once the browser is closed (the order screen then
 * shows the result).
 */
export async function payOnline(orderId: string, locale: "ar" | "en"): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return "sign_in_required";
  try {
    const res = await fetch(`${SITE_URL}/api/payments/start`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ orderId, locale }),
    });
    const body = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !body.url) return body.error ?? "gateway_error";
    await WebBrowser.openBrowserAsync(body.url);
    return null;
  } catch {
    return "gateway_error";
  }
}
