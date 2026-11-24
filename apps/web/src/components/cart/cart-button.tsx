"use client";

import { cartCount } from "@sarhad/core";
import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { useCart } from "./cart-provider";

export function CartButton() {
  const t = useTranslations("nav");
  const { cart } = useCart();
  const count = cartCount(cart);
  return (
    <Link
      href="/cart"
      className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
      aria-label={`${t("cart")} (${count})`}
      data-testid="cart-button"
    >
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 ? (
        <span className="absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground tabular-nums">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
