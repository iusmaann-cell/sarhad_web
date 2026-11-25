import { awaitingPayment, formatAddress, formatPrice, isOpenOrder } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@sarhad/ui";
import { ArrowLeft, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { AutoRefresh } from "@/components/orders/auto-refresh";
import { PrintButton } from "@/components/orders/print-button";
import { StatusActions } from "@/components/orders/status-actions";
import { getOrderDetail } from "@/lib/orders";
import { requireStaff } from "@/lib/staff";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">): Promise<Metadata> {
  const t = await getTranslations("ops");
  const order = await getOrderDetail((await params).id);
  return { title: order ? `#${order.order_number}` : t("title") };
}

export default async function OrderDetailPage({ params }: PageProps<"/orders/[id]">) {
  await requireStaff();
  const { id } = await params;
  const [t, ts, tc, locale, format] = await Promise.all([
    getTranslations("ops"),
    getTranslations("orderStatus"),
    getTranslations("checkout"),
    getLocale() as Promise<Locale>,
    getFormatter(),
  ]);
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const open = isOpenOrder(order.status);
  const unpaid = awaitingPayment(order);
  const when = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  const a = order.address;

  return (
    <div className="grid max-w-4xl gap-6">
      {open ? <AutoRefresh /> : null}
      <Link
        href={`/orders?branch=${order.branch_id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline print:hidden"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t("back")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("orderNumber", { number: order.order_number })}</h1>
          <p className="text-sm text-muted-foreground">
            {when(order.created_at)}
            {order.branch ? ` · ${localized(order.branch, "name", locale)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={order.type === "delivery" ? "secondary" : "muted"}>{t(order.type)}</Badge>
          <Badge variant={order.status === "cancelled" ? "muted" : "default"}>
            {ts(order.status)}
          </Badge>
          <PrintButton label={t("print")} />
        </div>
      </div>

      {open && unpaid ? <Alert>{t("awaitingPayment")}</Alert> : null}
      {open && !unpaid ? (
        <div className="print:hidden">
          <StatusActions
            orderId={order.id}
            orderNumber={order.order_number}
            type={order.type}
            status={order.status}
            size="default"
          />
        </div>
      ) : null}

      {order.status === "cancelled" ? (
        <Alert variant="destructive">
          {order.cancel_reason === "customer"
            ? t("cancelledByCustomer")
            : order.cancel_reason === "payment_timeout"
              ? t("paymentTimeout")
              : t("cancelReasonShown", { reason: order.cancel_reason ?? "-" })}
          {order.payment_method === "online" && order.payment_status === "paid" ? (
            <span className="mt-1 block font-medium">{t("refundHint")}</span>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
        <Card>
          <CardHeader>
            <CardTitle>{t("items")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ul className="grid gap-3">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      <span className="tabular-nums">{i.quantity}×</span>{" "}
                      {localized(i, "name", locale)}
                    </p>
                    {i.options.length ? (
                      <p className="text-sm text-muted-foreground">
                        {i.options.map((o) => localized(o, "name", locale)).join("، ")}
                      </p>
                    ) : null}
                    {i.notes ? (
                      <p className="text-sm text-amber-700">
                        {t("itemNote")}: {i.notes}
                      </p>
                    ) : null}
                  </div>
                  <span className="tabular-nums">{formatPrice(i.line_total_fils, locale)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("subtotal")}</dt>
                <dd className="tabular-nums">{formatPrice(order.subtotal_fils, locale)}</dd>
              </div>
              {order.type === "delivery" ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("deliveryFee")}</dt>
                  <dd className="tabular-nums">{formatPrice(order.delivery_fee_fils, locale)}</dd>
                </div>
              ) : null}
              {order.discount_fils > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  <dt>
                    {t("discount")}
                    {order.promo_code ? ` (${order.promo_code})` : ""}
                  </dt>
                  <dd className="tabular-nums">−{formatPrice(order.discount_fils, locale)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-semibold">
                <dt>{t("total")}</dt>
                <dd className="tabular-nums">{formatPrice(order.total_fils, locale)}</dd>
              </div>
              <p className="text-end text-xs text-muted-foreground">
                {order.payment_status === "paid"
                  ? order.payment_method === "online"
                    ? t("paidOnline")
                    : t("paid")
                  : order.payment_method === "online"
                    ? t("awaitingPayment")
                    : t("unpaid")}
              </p>
            </dl>
            {order.notes ? (
              <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
                <span className="font-medium">{t("notes")}: </span>
                {order.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("customer")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p className="font-medium">{order.customer_name}</p>
              <a
                href={`tel:${order.customer_phone}`}
                className="inline-flex items-center gap-2 text-primary underline"
                dir="ltr"
              >
                <Phone className="size-4" aria-hidden /> {order.customer_phone}
              </a>
              {a ? (
                <>
                  <p className="mt-2">
                    {formatAddress(a, {
                      block: tc("block"),
                      street: tc("street"),
                      avenue: tc("avenue"),
                      building: tc("building"),
                      floor: tc("floor"),
                      apartment: tc("apartment"),
                    })}
                  </p>
                  {a.notes ? <p className="text-muted-foreground">{a.notes}</p> : null}
                  <a
                    href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-primary underline print:hidden"
                  >
                    <MapPin className="size-4" aria-hidden /> {t("openMap")}
                  </a>
                  {order.eta_minutes ? (
                    <p className="text-muted-foreground">
                      {t("eta", { minutes: order.eta_minutes })}
                    </p>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-2 text-sm">
                {order.events.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3">
                    <span>{ts(e.status)}</span>
                    <span className="text-muted-foreground tabular-nums">{when(e.created_at)}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
