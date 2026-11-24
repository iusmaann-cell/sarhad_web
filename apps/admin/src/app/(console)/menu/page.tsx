import { formatPrice, menuImageUrl } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@sarhad/ui";
import { Plus, ToggleRight } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export default async function MenuPage() {
  const staff = await requireStaff();
  const [t, tc, tm, locale] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    getTranslations("menu"),
    getLocale() as Promise<Locale>,
  ]);
  const supabase = await createClient();
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("menu_categories").select("*").order("sort_order").order("name_en"),
    supabase.from("menu_items").select("*").order("sort_order").order("name_en"),
  ]);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("menu")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/menu/availability">
              <ToggleRight /> {t("availability")}
            </Link>
          </Button>
          {staff.isAdmin ? (
            <>
              <Button asChild variant="outline">
                <Link href="/menu/categories/new">
                  <Plus /> {t("newCategory")}
                </Link>
              </Button>
              {categories?.length ? (
                <Button asChild>
                  <Link href="/menu/items/new">
                    <Plus /> {t("newItem")}
                  </Link>
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {!categories?.length ? <p className="text-muted-foreground">{t("noCategories")}</p> : null}

      {(categories ?? []).map((c) => {
        const list = (items ?? []).filter((i) => i.category_id === c.id);
        return (
          <Card key={c.id}>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle>{localized(c, "name", locale)}</CardTitle>
                {!c.is_active ? <Badge variant="muted">{t("hidden")}</Badge> : null}
              </div>
              {staff.isAdmin ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/menu/categories/${c.id}`}>{tc("edit")}</Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noItems")}</p>
              ) : (
                <ul className="divide-y">
                  {list.map((i) => {
                    const img = menuImageUrl(supabaseUrl, i.image_path);
                    return (
                      <li key={i.id} className="flex items-center gap-3 py-3">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" className="size-12 rounded-md object-cover" />
                        ) : (
                          <div className="size-12 rounded-md bg-muted" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-medium">
                            {localized(i, "name", locale)}
                            {i.is_featured ? <Badge>{tm("featured")}</Badge> : null}
                            {!i.is_active ? <Badge variant="muted">{t("hidden")}</Badge> : null}
                          </p>
                          <p className="text-sm text-muted-foreground tabular-nums">
                            {formatPrice(i.price_fils, locale)}
                          </p>
                        </div>
                        {staff.isAdmin ? (
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/menu/items/${i.id}`}>{tc("edit")}</Link>
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
