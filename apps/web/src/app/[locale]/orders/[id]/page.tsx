import { awaitingPayment, formatAddress, formatPrice, isOpenOrder } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@sarhad/ui";
import { MapPin, Phone, Store } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { CancelOrderButton } from "@/components/orders/cancel-order-button";
import { OrderLive } from "@/components/orders/order-live";
import { OrderTracker } from "@/components/orders/order-tracker";
import { PayButton } from "@/components/orders/pay-button";
import { getOrder } from "@/lib/orders";

export const metadata: Metadata = { robots: { index: false } };

export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/[locale]/orders/[id]">) {
  const { locale: l, id } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const sp = await searchParams;
  const order = await getOrder(id);
  if (!order) notFound();

  const [t, tc, ts, format] = await Promise.all([
    getTranslations("orders"),
    getTranslations("checkout"),
    getTranslations("orderStatus"),
    getFormatter(),
  ]);
  const branchName = order.branch ? localized(order.branch, "name", locale) : "";
  const active = isOpenOrder(order.status);
  const unpaid = awaitingPayment(order) && order.status === "pending";
  const paymentResult = typeof sp.payment === "string" ? sp.payment : null;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <OrderLive active={active} />
      {sp.placed && !unpaid ? <Alert variant="success">{t("thanks")}</Alert> : null}
      {paymentResult === "paid" ? (
        <Alert variant="success">{t("paymentDone")}</Alert>
      ) : paymentResult === "failed" || paymentResult === "cancelled" ? (
        unpaid ? (
          <Alert variant="destructive">{t("paymentFailed")}</Alert>
        ) : null
      ) : paymentResult === "pending" && unpaid ? (
        <Alert>{t("paymentPending")}</Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("orderNumber", { number: order.order_number })}</h1>
          <p className="text-sm text-muted-foreground">
            {t("placedAt", {
              date: format.dateTime(new Date(order.created_at), {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Kuwait",
              }),
            })}
          </p>
        </div>
        <Badge
          variant={
            order.status === "cancelled"
              ? "muted"
              : order.status === "completed"
                ? "success"
                : "default"
          }
          data-testid="order-status"
        >
          {ts(order.status)}
        </Badge>
      </div>

      {order.status === "cancelled" ? (
        <Alert variant="destructive">
          {order.cancel_reason === "payment_timeout" ? t("paymentTimeout") : t("cancelled")}
          {order.cancel_reason &&
          order.cancel_reason !== "customer" &&
          order.cancel_reason !== "payment_timeout"
            ? ` ${t("cancelReason", { reason: order.cancel_reason })}`
            : null}
        </Alert>
      ) : unpaid ? (
        <Card className="border-primary">
          <CardContent className="grid gap-3 pt-6">
            <p className="text-lg font-semibold">{t("paymentWaiting")}</p>
            <p className="text-sm text-muted-foreground">{t("paymentWaitingHint")}</p>
            <PayButton
              orderId={order.id}
              label={t("payNow", { total: formatPrice(order.total_fils, locale) })}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="grid gap-4 pt-6">
            <OrderTracker type={order.type} status={order.status} />
            {order.type === "delivery" && order.eta_minutes && active ? (
              <p className="text-sm text-muted-foreground">
                {t("eta", { minutes: order.eta_minutes })}
              </p>
            ) : null}
            {active ? <p className="text-xs text-muted-foreground">{t("autoRefresh")}</p> : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("items")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <ul className="grid gap-2">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  {i.quantity} × {localized(i, "name", locale)}
                  {i.options.length ? (
                    <span className="block text-xs text-muted-foreground">
                      {i.options.map((o) => localized(o, "name", locale)).join("، ")}
                    </span>
                  ) : null}
                  {i.notes ? (
                    <span className="block text-xs text-muted-foreground">“{i.notes}”</span>
                  ) : null}
                </span>
                <span className="tabular-nums">{formatPrice(i.line_total_fils, locale)}</span>
              </li>
            ))}
          </ul>
          <div className="grid gap-1 border-t pt-3">
            <div className="flex justify-between">
              <span>{tc("subtotal")}</span>
              <span className="tabular-nums">{formatPrice(order.subtotal_fils, locale)}</span>
            </div>
            {order.type === "delivery" ? (
              <div className="flex justify-between">
                <span>{tc("deliveryFee")}</span>
                <span className="tabular-nums">
                  {order.delivery_fee_fils === 0
                    ? tc("free")
                    : formatPrice(order.delivery_fee_fils, locale)}
                </span>
              </div>
            ) : null}
            {order.discount_fils > 0 ? (
              <div className="flex justify-between text-success">
                <span>
                  {tc("discount")}
                  {order.promo_code ? ` (${order.promo_code})` : ""}
                </span>
                <span className="tabular-nums">−{formatPrice(order.discount_fils, locale)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-bold">
              <span>{tc("total")}</span>
              <span className="tabular-nums">{formatPrice(order.total_fils, locale)}</span>
            </div>
          </div>
          <p className="font-medium" data-testid="payment-line">
            {order.payment_method === "cash"
              ? t("payCash", { total: formatPrice(order.total_fils, locale) })
              : order.payment_status === "paid"
                ? t("paidOnline")
                : t("payOnlineDue")}
          </p>
          {order.notes ? (
            <p className="text-muted-foreground">
              {t("notes")}: {order.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 pt-6 text-sm">
          {order.type === "delivery" ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium">{t("deliverTo")}: </span>
                {formatAddress(order.address, {
                  block: tc("block"),
                  street: tc("street"),
                  avenue: tc("avenue"),
                  building: tc("building"),
                  floor: tc("floor"),
                  apartment: tc("apartment"),
                })}
              </span>
            </p>
          ) : (
            <p className="flex items-center gap-2">
              <Store className="size-4 text-primary" aria-hidden />
              <span className="font-medium">{t("pickupAt")}:</span> {branchName}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {order.branch?.phone ? (
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${order.branch.phone.replace(/\s/g, "")}`}>
                  <Phone /> {t("callBranch")}
                </a>
              </Button>
            ) : null}
          </div>
          {order.status === "pending" ? <CancelOrderButton id={order.id} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
