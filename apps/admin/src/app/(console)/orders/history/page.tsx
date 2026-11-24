import { formatPrice, ORDER_STATUSES, type OrderStatus } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Badge, Button, Card, Input, Select } from "@sarhad/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { searchOrders, staffBranches, type HistoryFilters } from "@/lib/orders";
import { requireStaff } from "@/lib/staff";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ops");
  return { title: t("history") };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v || undefined;
}

export default async function OrderHistoryPage({ searchParams }: PageProps<"/orders/history">) {
  const staff = await requireStaff();
  const [t, ts, locale, format] = await Promise.all([
    getTranslations("ops"),
    getTranslations("orderStatus"),
    getLocale() as Promise<Locale>,
    getFormatter(),
  ]);
  const branches = await staffBranches(staff);
  const sp = await searchParams;

  const status = one(sp.status);
  const from = one(sp.from);
  const to = one(sp.to);
  const filters: HistoryFilters = {
    branch: branches.some((b) => b.id === one(sp.branch)) ? one(sp.branch) : undefined,
    status: ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined,
    from: from && DAY.test(from) ? from : undefined,
    to: to && DAY.test(to) ? to : undefined,
    q: one(sp.q)?.slice(0, 40),
    page: Math.max(1, Math.min(1000, Number(one(sp.page)) || 1)),
  };
  const { rows, more } = await searchOrders(filters);

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, page })) if (v) params.set(k, String(v));
    return `/orders/history?${params}`;
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("history")}</h1>
        <Button asChild variant="outline">
          <Link href={filters.branch ? `/orders?branch=${filters.branch}` : "/orders"}>
            {t("title")}
          </Link>
        </Button>
      </div>

      <form className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <label className="grid gap-1 text-sm lg:col-span-2">
          <span className="font-medium">{t("search")}</span>
          <Input name="q" defaultValue={filters.q} dir="auto" />
        </label>
        {branches.length > 1 ? (
          <label className="grid gap-1 text-sm">
            <span className="font-medium">{t("branch")}</span>
            <Select name="branch" defaultValue={filters.branch ?? ""}>
              <option value="">-</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {localized(b, "name", locale)}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("status")}</span>
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">{t("allStatuses")}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ts(s)}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("from")}</span>
          <Input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("to")}</span>
          <Input type="date" name="to" defaultValue={filters.to} />
        </label>
        <Button type="submit">{t("filter")}</Button>
      </form>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th className="p-3 text-start font-medium">#</th>
              <th className="p-3 text-start font-medium">{t("date")}</th>
              <th className="p-3 text-start font-medium">{t("customer")}</th>
              <th className="p-3 text-start font-medium">{t("type")}</th>
              {branches.length > 1 ? (
                <th className="p-3 text-start font-medium">{t("branch")}</th>
              ) : null}
              <th className="p-3 text-start font-medium">{t("status")}</th>
              <th className="p-3 text-end font-medium">{t("total")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-t hover:bg-muted/50">
                <td className="p-3 font-semibold">
                  <Link href={`/orders/${o.id}`} className="hover:underline">
                    {o.order_number}
                  </Link>
                </td>
                <td className="p-3 tabular-nums text-muted-foreground">
                  {format.dateTime(new Date(o.created_at), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="p-3">
                  {o.customer_name}
                  <span className="block text-xs text-muted-foreground" dir="ltr">
                    {o.customer_phone}
                  </span>
                </td>
                <td className="p-3">{t(o.type)}</td>
                {branches.length > 1 ? (
                  <td className="p-3">{o.branch ? localized(o.branch, "name", locale) : ""}</td>
                ) : null}
                <td className="p-3">
                  <Badge
                    variant={
                      o.status === "completed"
                        ? "success"
                        : o.status === "cancelled"
                          ? "muted"
                          : "default"
                    }
                  >
                    {ts(o.status)}
                  </Badge>
                </td>
                <td className="p-3 text-end tabular-nums">{formatPrice(o.total_fils, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">{t("noResults")}</p>
        ) : null}
      </Card>

      {filters.page > 1 || more ? (
        <div className="flex justify-between">
          {filters.page > 1 ? (
            <Button asChild variant="outline">
              <Link href={pageHref(filters.page - 1)}>{t("previous")}</Link>
            </Button>
          ) : (
            <span />
          )}
          {more ? (
            <Button asChild variant="outline">
              <Link href={pageHref(filters.page + 1)}>{t("next")}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
