import { NextResponse, type NextRequest } from "next/server";

import { siteOrigin } from "@/lib/origin";
import { setTestOutcome } from "@/lib/payments/service";

/** The test gateway's Pay / Decline buttons post here (a full page navigation, like a real gateway). */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const payment = String(form.get("payment") ?? "");
  const outcome = form.get("outcome") === "paid" ? "paid" : "declined";
  const origin = await siteOrigin();
  const back = await setTestOutcome(payment, outcome);
  // Only ever redirect to this site's own return page.
  const url =
    back && back.startsWith(`${origin}/api/payments/return?`)
      ? back
      : `${origin}/api/payments/return?payment=${encodeURIComponent(payment)}`;
  return NextResponse.redirect(url, 303);
}
