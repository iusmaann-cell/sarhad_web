import type { MetadataRoute } from "next";

import { siteOrigin } from "@/lib/origin";

// Public pages, each in Arabic ("/") and English ("/en").
const PAGES = ["", "/menu", "/branches", "/delivery", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  return PAGES.map((page) => ({
    url: `${origin}${page || "/"}`,
    changeFrequency: page === "/menu" || page === "" ? "daily" : "monthly",
    priority: page === "" ? 1 : 0.7,
    alternates: { languages: { ar: `${origin}${page || "/"}`, en: `${origin}/en${page}` } },
  }));
}
