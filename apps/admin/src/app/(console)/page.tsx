import { formatPrice } from "@sarhad/core";
import type { Locale } from "@sarhad/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@sarhad/ui";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const staff = await requireStaff();
  const [t, to, locale] = await Promise.all([
    getTranslations("admin"),
    getTranslations("ops"),
    getLocale() as Promise<Locale>,
  ]);
  const supabase = await createClient();

  const [{ data: branches }, { data: team }, { data: orderStats }] = await Promise.all([
    supabase.from("branches").select("id, is_active"),
    supabase.rpc("list_staff"),
    supabase.rpc("order_stats", {}),
  ]);
  const o = orderStats?.[0];
  const today = [
    { label: to("statOpen"), value: String(o?.open_orders ?? 0), href: "/orders" },
    { label: to("statOrdersToday"), value: String(o?.orders_today ?? 0), href: "/orders/history" },
    { label: to("statSales"), value: formatPrice(Number(o?.sales_today_fils ?? 0), locale) },
    { label: to("statCancelled"), value: String(o?.cancelled_today ?? 0) },
  ];

  const stats = [
    { label: t("statBranches"), value: branches?.length ?? 0 },
    { label: t("statActiveBranches"), value: branches?.filter((b) => b.is_active).length ?? 0 },
    { label: t("statStaff"), value: new Set(team?.map((s) => s.user_id)).size },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("welcome", { name: staff.name })}</h1>
        <p className="text-muted-foreground">{t("dashboardIntro")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {today.map((s) => {
          const card = (
            <Card className={s.href ? "h-full transition-colors hover:border-primary" : "h-full"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          );
          return s.href ? (
            <Link key={s.label} href={s.href}>
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
