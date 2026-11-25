import { NextResponse, type NextRequest } from "next/server";

import { siteOrigin } from "@/lib/origin";
import { confirmPayment } from "@/lib/payments/service";

/** The gateway sends the customer back here. The result is checked with the gateway. */
export async function GET(request: NextRequest) {
  const origin = await siteOrigin();
  const paymentId = request.nextUrl.searchParams.get("payment") ?? "";
  const result = await confirmPayment(paymentId, origin);
  if (!result) return NextResponse.redirect(new URL("/orders", origin));
  // Paid from the mobile app: the browser is not signed in, so show a result page
  // that leads back to the app instead of the website's order page.
  const fromApp = request.nextUrl.searchParams.get("app") === "1";
  const url = new URL(fromApp ? "/pay/result" : `/orders/${result.orderId}`, origin);
  url.searchParams.set("payment", result.status);
  if (fromApp) url.searchParams.set("order", result.orderId);
  return NextResponse.redirect(url);
}
