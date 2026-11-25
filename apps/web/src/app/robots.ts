import type { MetadataRoute } from "next";

import { siteOrigin } from "@/lib/origin";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in and transactional pages have nothing for search engines.
      disallow: [
        "/api/",
        "/account",
        "/checkout",
        "/orders",
        "/pay",
        "/en/account",
        "/en/checkout",
        "/en/orders",
        "/en/pay",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
