import "server-only";

import { localized, type Locale } from "@sarhad/i18n";
import { getLocale } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

export async function loadCategories() {
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const { data } = await supabase
    .from("menu_categories")
    .select("id, name_en, name_ar")
    .order("sort_order");
  return (data ?? []).map((c) => ({ id: c.id, name: localized(c, "name", locale) }));
}
