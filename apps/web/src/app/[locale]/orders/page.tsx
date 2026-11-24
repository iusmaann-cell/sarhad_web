import { formatPrice } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Badge, Button, Card, CardContent } from "@sarhad/ui";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getMyOrders } from "@/lib/orders";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/orders">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "orders" });
  return { title: t("title"), robots: { index: false } };
}

export default async function OrdersPage({ params }: PageProps<"/[locale]/orders">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, ts, tn, format, orders] = await Promise.all([
    getTranslations("orders"),
    getTranslations("orderStatus"),
    getTranslations("nav"),
    getFormatter(),
    getMyOrders(),
  ]);

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/account">{tn("account")}</Link>
        </Button>
      </div>
      {orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-muted-foreground">{t("noOrders")}</CardContent>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted"
                >
                  <span>
                    <span className="block font-medium">
                      {t("orderNumber", { number: o.order_number })}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {o.branch ? localized(o.branch, "name", locale) : ""} ·{" "}
                      {format.dateTime(new Date(o.created_at), {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kuwait",
                      })}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge
                      variant={
                        o.status === "cancelled"
                          ? "muted"
                          : o.status === "completed"
                            ? "success"
                            : "default"
                      }
                    >
                      {ts(o.status)}
                    </Badge>
                    <span className="font-semibold tabular-nums">
                      {formatPrice(o.total_fils, locale)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
