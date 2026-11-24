"use client";

import { cartSubtotal, formatPrice } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Alert, Button, Card, CardContent } from "@sarhad/ui";
import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { QuantityStepper } from "@/components/menu/add-to-cart";
import { Link } from "@/i18n/navigation";

import { useCart } from "./cart-provider";
import { useFreshCart } from "./use-fresh-cart";

export function CartView() {
  const t = useTranslations("cart");
  const locale = useLocale() as Locale;
  const { setQuantity } = useCart();
  const { cart, ready, branch, removed, checked } = useFreshCart();

  if (!ready || !checked) {
    return <p className="text-muted-foreground">…</p>;
  }

  if (cart.lines.length === 0) {
    return (
      <div className="grid gap-4">
        {removed > 0 ? <Alert>{t("removedItems", { count: removed })}</Alert> : null}
        <Card>
          <CardContent className="grid justify-items-start gap-4 pt-6">
            <p className="text-muted-foreground">{t("empty")}</p>
            <Button asChild>
              <Link href="/menu">{t("browseMenu")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {branch ? (
        <p className="text-muted-foreground">
          {t("fromBranch", { branch: localized(branch, "name", locale) })}
        </p>
      ) : null}
      {removed > 0 ? <Alert>{t("removedItems", { count: removed })}</Alert> : null}
      <Card>
        <ul className="divide-y" data-testid="cart-lines">
          {cart.lines.map((l) => (
            <li key={l.key} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{locale === "ar" ? l.nameAr : l.nameEn}</p>
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
              <QuantityStepper value={l.quantity} onChange={(n) => setQuantity(l.key, n)} />
              <span className="w-28 text-end font-semibold tabular-nums">
                {formatPrice(l.unitPriceFils * l.quantity, locale)}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(l.key, 0)}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label={`${t("remove")}: ${locale === "ar" ? l.nameAr : l.nameEn}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t p-4">
          <span className="font-medium">{t("subtotal")}</span>
          <span className="text-lg font-bold tabular-nums" data-testid="cart-subtotal">
            {formatPrice(cartSubtotal(cart), locale)}
          </span>
        </div>
      </Card>
      <p className="text-sm text-muted-foreground">{t("pricesUpdated")}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg">
          <Link href="/checkout">{t("checkout")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={branch ? { pathname: "/menu", query: { branch: branch.slug } } : "/menu"}>
            {t("browseMenu")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
