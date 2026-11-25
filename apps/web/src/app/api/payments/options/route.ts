import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { supabaseEnv } from "@/lib/env";
import { allowTestGateway } from "@/lib/payments/gateways";
import { hasAdminKey } from "@/lib/supabase/admin";

const CORS = { "Access-Control-Allow-Origin": "*" };

/** Online payment options the mobile app may offer (the same list as the website's checkout). */
export async function GET() {
  if (!hasAdminKey()) return NextResponse.json({ providers: [] }, { headers: CORS });
  const { url, key } = supabaseEnv();
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase
    .from("payment_providers")
    .select("id, kind, name_en, name_ar")
    .eq("is_active", true)
    .order("sort_order");
  const providers = (data ?? [])
    .filter((p) => p.kind !== "test" || allowTestGateway())
    .map(({ id, name_en, name_ar }) => ({ id, name_en, name_ar }));
  return NextResponse.json({ providers }, { headers: CORS });
}
