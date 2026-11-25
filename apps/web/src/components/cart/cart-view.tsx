"use client";

import { cartSubtotal, formatPrice } from "@sarhad/core";
import type { Locale } from "@sarhad/i18n";
import { Alert } from "@sarhad/ui";
import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { QuantityStepper } from "@/components/menu/add-to-cart";
import { OrderStartCard } from "@/components/order-start/order-chip";
import { useOrderStart } from "@/components/order-start/order-start-provider";
import { Link } from "@/i18n/navigation";

import { useCart } from "./cart-provider";
import { useFreshCart } from "./use-fresh-cart";

export function CartView() {
  const t = useTranslations("cart");
  const tco = useTranslations("checkout");
  const locale = useLocale() as Locale;
  const { setQuantity } = useCart();
  const { start } = useOrderStart();
  const { cart, ready, removed, checked } = useFreshCart();

  if (!ready || !checked) {
    return <p className="text-muted-foreground">…</p>;
  }

  if (cart.lines.length === 0) {
    return (
      <div className="grid gap-4">
        {removed > 0 ? <Alert>{t("removedItems", { count: removed })}</Alert> : null}
        <div className="grid justify-items-start gap-4 rounded-[1.25rem] border border-border bg-card p-6">
          <p className="text-muted-foreground">{t("empty")}</p>
          <Link href="/menu" className="btn-brand inline-flex h-12 items-center px-6">
            {t("browseMenu")}
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = cartSubtotal(cart);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="grid gap-3">
        <OrderStartCard />
        {removed > 0 ? <Alert>{t("removedItems", { count: removed })}</Alert> : null}
        <ul className="grid gap-3" data-testid="cart-lines">
          {cart.lines.map((l) => {
            const name = locale === "ar" ? l.nameAr : l.nameEn;
            return (
              <li
                key={l.key}
                className="grid gap-3 rounded-[1.25rem] border border-border bg-card p-4"
              >
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold">{name}</p>
                    {l.optionNames.length ? (
                      <p className="text-sm text-muted-foreground">
                        {l.optionNames.map((o) => (locale === "ar" ? o.ar : o.en)).join("، ")}
                      </p>
                    ) : null}
                    {l.notes ? <p className="text-sm text-muted-foreground">“{l.notes}”</p> : null}
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {formatPrice(l.unitPriceFils, locale)}
                    </p>
                  </div>
                  <span className="font-extrabold tabular-nums">
                    {formatPrice(l.unitPriceFils * l.quantity, locale)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity(l.key, 0)}
                    className="flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:text-destructive"
                    aria-label={`${t("remove")}: ${name}`}
                  >
                    <Trash2 className="size-4" aria-hidden /> {t("remove")}
                  </button>
                  <QuantityStepper value={l.quantity} onChange={(n) => setQuantity(l.key, n)} />
                </div>
              </li>
            );
          })}
        </ul>
        <Link href="/menu" className="py-2 font-bold text-brand-amber hover:underline">
          + {t("addMore")}
        </Link>
      </div>

      <div className="grid gap-3 rounded-[1.25rem] border border-border bg-card p-5 lg:sticky lg:top-24">
        <div className="flex justify-between text-[#c8c8c8]">
          <span>{t("subtotal")}</span>
          <span className="tabular-nums" data-testid="cart-subtotal">
            {formatPrice(subtotal, locale)}
          </span>
        </div>
        {start?.type === "delivery" ? (
          <div className="flex justify-between text-[#c8c8c8]">
            <span>{t("deliveryAtCheckout")}</span>
            <span className="tabular-nums">
              {start.area.fee_fils === 0 ? tco("free") : formatPrice(start.area.fee_fils, locale)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-border pt-3 text-lg font-extrabold">
          <span>{tco("total")}</span>
          <span className="tabular-nums">
            {formatPrice(subtotal + (start?.type === "delivery" ? start.area.fee_fils : 0), locale)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{t("pricesUpdated")}</p>
        <Link
          href="/checkout"
          className="btn-brand inline-flex h-14 items-center justify-center text-base"
        >
          {t("checkout")}
        </Link>
      </div>
    </div>
  );
}
