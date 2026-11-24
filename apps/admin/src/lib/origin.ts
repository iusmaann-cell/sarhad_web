import "server-only";

import { headers } from "next/headers";

/** Public origin of this site, used to build links in emails. */
export async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_ADMIN_URL)
    return process.env.NEXT_PUBLIC_ADMIN_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
