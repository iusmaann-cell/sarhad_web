import { formatPrice, promoLastDay, kuwaitDay } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Badge, Button, Card, CardDescription } from "@sarhad/ui";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import { promoBranches } from "./load";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("promos");
  return { title: t("title") };
}

export default async function PromotionsPage() {
  const staff = await requireStaff();
  const [t, locale, editable] = await Promise.all([
    getTranslations("promos"),
    getLocale() as Promise<Locale>,
    promoBranches(staff),
  ]);
  const supabase = await createClient();
  const [{ data: promos }, { data: branches }] = await Promise.all([
    supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
    supabase.from("branches").select("id, name_en, name_ar"),
  ]);
  const uses = await Promise.all(
    (promos ?? []).map(
      async (p) => (await supabase.rpc("promo_uses", { p_promo_id: p.id })).data ?? 0,
    ),
  );
  const branchName = new Map((branches ?? []).map((b) => [b.id, localized(b, "name", locale)]));
  const canEdit = (branchId: string | null) =>
    staff.isAdmin || (!!branchId && editable.some((b) => b.id === branchId));
  const now = new Date().toISOString();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <CardDescription>{t("intro")}</CardDescription>
        </div>
        {staff.isAdmin || editable.length ? (
          <Button asChild>
            <Link href="/promotions/new">
              <Plus /> {t("new")}
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th className="p-3 text-start font-medium">{t("code")}</th>
              <th className="p-3 text-start font-medium">{t("kind")}</th>
              <th className="p-3 text-start font-medium">{t("branch")}</th>
              <th className="p-3 text-start font-medium">{t("valid")}</th>
              <th className="p-3 text-start font-medium">{t("uses")}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {(promos ?? []).map((p, i) => {
              const expired = !!p.ends_at && p.ends_at <= now;
              const discount =
                p.kind === "percent"
                  ? t("off", { value: p.value })
                  : p.kind === "fixed"
                    ? t("offAmount", { amount: formatPrice(p.value, locale) })
                    : t("freeDelivery");
              const extras = [
                p.max_discount_fils
                  ? t("upTo", { amount: formatPrice(p.max_discount_fils, locale) })
                  : null,
                p.min_subtotal_fils
                  ? t("minOrder", { amount: formatPrice(p.min_subtotal_fils, locale) })
                  : null,
              ].filter(Boolean);
              const from = p.starts_at ? kuwaitDay(p.starts_at) : null;
              const to = p.ends_at ? promoLastDay(p.ends_at) : null;
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-3">
                    <span className="font-mono font-semibold" dir="ltr">
                      {p.code}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {localized(p, "name", locale)}
                    </span>
                  </td>
                  <td className="p-3">
                    {discount}
                    {extras.length ? (
                      <span className="block text-xs text-muted-foreground">
                        {extras.join(" · ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">
                    {p.branch_id ? branchName.get(p.branch_id) : t("allBranches")}
                  </td>
                  <td className="p-3 tabular-nums">
                    {from && to
                      ? t("fromTo", { from, to })
                      : from
                        ? t("from", { date: from })
                        : to
                          ? t("until", { date: to })
                          : t("always")}
                    {!p.is_active ? (
                      <Badge variant="muted" className="ms-2">
                        {t("inactive")}
                      </Badge>
                    ) : expired ? (
                      <Badge variant="muted" className="ms-2">
                        {t("expired")}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="p-3 tabular-nums">
                    {uses[i]}
                    {p.max_uses ? ` / ${p.max_uses}` : ""}
                  </td>
                  <td className="p-3 text-end">
                    {canEdit(p.branch_id) ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/promotions/${p.id}`}>{t("edit")}</Link>
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!promos?.length ? (
          <p className="p-6 text-center text-muted-foreground">{t("none")}</p>
        ) : null}
      </Card>
    </div>
  );
}
