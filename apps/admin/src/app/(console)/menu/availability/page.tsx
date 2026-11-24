import { canManageBranch, formatPrice } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Card, CardDescription } from "@sarhad/ui";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import { AvailabilityRow } from "./availability-row";

export default async function AvailabilityPage({ searchParams }: PageProps<"/menu/availability">) {
  const staff = await requireStaff();
  const [t, tc, locale] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    getLocale() as Promise<Locale>,
  ]);
  const supabase = await createClient();
  // RLS limits this to branches the staff member works in.
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name_en, name_ar")
    .order("sort_order");
  const list = (branches ?? []).filter(
    (b) => staff.isAdmin || staff.roles.some((r) => r.branch_id === b.id),
  );
  const sp = await searchParams;
  const branch = list.find((b) => b.id === sp.branch) ?? list[0];

  if (!branch) return <p className="text-muted-foreground">{tc("notFound")}</p>;

  const [{ data: categories }, { data: items }, { data: overrides }] = await Promise.all([
    supabase.from("menu_categories").select("id, name_en, name_ar").order("sort_order"),
    supabase
      .from("menu_items")
      .select("id, category_id, name_en, name_ar, price_fils, is_active")
      .order("sort_order"),
    supabase.from("branch_menu_items").select("*").eq("branch_id", branch.id),
  ]);
  const byItem = new Map((overrides ?? []).map((o) => [o.item_id, o]));
  const canPrice = canManageBranch(staff.roles, branch.id);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("availability")}</h1>
        <CardDescription>{t("availabilityHint")}</CardDescription>
      </div>

      {list.length > 1 ? (
        <nav aria-label={t("branchFilter")} className="flex flex-wrap gap-2">
          {list.map((b) => (
            <Link
              key={b.id}
              href={`/menu/availability?branch=${b.id}`}
              aria-current={b.id === branch.id ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${b.id === branch.id ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            >
              {localized(b, "name", locale)}
            </Link>
          ))}
        </nav>
      ) : null}

      {(categories ?? []).map((c) => {
        const rows = (items ?? []).filter((i) => i.category_id === c.id && i.is_active);
        if (!rows.length) return null;
        return (
          <Card key={c.id} className="overflow-x-auto">
            <h2 className="border-b p-3 font-semibold">{localized(c, "name", locale)}</h2>
            <table className="w-full min-w-[40rem] table-fixed text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="w-1/4 p-3 text-start font-medium">{t("branchName")}</th>
                  <th className="w-1/6 p-3 text-start font-medium">{t("basePrice")}</th>
                  <th className="w-1/6 p-3 text-start font-medium">{t("available")}</th>
                  {canPrice ? (
                    <th className="w-1/4 p-3 text-start font-medium">{t("branchPrice")}</th>
                  ) : null}
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => {
                  const o = byItem.get(i.id);
                  return (
                    <AvailabilityRow
                      key={i.id}
                      branchId={branch.id}
                      itemId={i.id}
                      name={localized(i, "name", locale)}
                      basePrice={formatPrice(i.price_fils, locale)}
                      available={o?.is_available ?? true}
                      priceOverrideFils={o?.price_override_fils ?? null}
                      canPrice={canPrice}
                    />
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}
