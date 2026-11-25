// Health check for the host or an uptime monitor: 200 when this app is up and
// can reach Supabase, 503 otherwise.
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let supabase: "ok" | "down" = "down";
  if (url && key) {
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
        headers: { apikey: key },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) supabase = "ok";
    } catch {
      // Reported as down below.
    }
  }
  const ok = supabase === "ok";
  return Response.json(
    { ok, supabase },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
