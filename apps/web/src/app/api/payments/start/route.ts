import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { supabaseEnv } from "@/lib/env";
import { siteOrigin } from "@/lib/origin";
import { startPayment } from "@/lib/payments/service";

// The app sends a bearer token, never cookies, so any origin may call this.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Used by the mobile app: POST { orderId, locale } with the customer's access
 * token as "Authorization: Bearer ...". Returns { url } of the payment page.
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token)
    return NextResponse.json({ error: "sign_in_required" }, { status: 401, headers: CORS });
  const { url, key } = supabaseEnv();
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth.user)
    return NextResponse.json({ error: "sign_in_required" }, { status: 401, headers: CORS });

  const body = (await request.json().catch(() => ({}))) as { orderId?: string; locale?: string };
  if (typeof body.orderId !== "string") {
    return NextResponse.json({ error: "not_found" }, { status: 400, headers: CORS });
  }
  const result = await startPayment({
    orderId: body.orderId,
    customerId: auth.user.id,
    origin: await siteOrigin(),
    locale: body.locale === "en" ? "en" : "ar",
    from: "app",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409, headers: CORS });
  return NextResponse.json({ url: result.url }, { headers: CORS });
}
