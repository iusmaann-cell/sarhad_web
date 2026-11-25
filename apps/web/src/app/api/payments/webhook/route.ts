import { NextResponse, type NextRequest } from "next/server";

import { siteOrigin } from "@/lib/origin";
import { confirmPayment } from "@/lib/payments/service";

/**
 * Server-to-server notice from the gateway. The body is not trusted: the
 * payment is looked up and its result fetched from the gateway again.
 */
export async function POST(request: NextRequest) {
  const paymentId = request.nextUrl.searchParams.get("payment") ?? "";
  const result = await confirmPayment(paymentId, await siteOrigin());
  return NextResponse.json({ ok: !!result });
}
