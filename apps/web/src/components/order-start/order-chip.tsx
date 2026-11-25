"use client";

import { localized, type Locale } from "@sarhad/i18n";
import { cn } from "@sarhad/ui";
import { Bike, ChevronDown, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { useOrderStart } from "./order-start-provider";

/** "Delivery to Salmiya · Change": shows the current choice and reopens the chooser. */
export function OrderChip({ className }: { className?: string }) {
  const t = useTranslations("start");
  const locale = useLocale() as Locale;
  const { start, openChooser } = useOrderStart();
  const Icon = start?.type === "pickup" ? Store : Bike;
  // Narrow screens show just the area or branch name.
  const short = !start
    ? t("chooseHow")
    : localized(start.type === "delivery" ? start.area : start.branch, "name", locale);
  const label = !start
    ? t("chooseHow")
    : start.type === "delivery"
      ? t("deliveryTo", { area: localized(start.area, "name", locale) })
      : t("pickupFrom", { branch: localized(start.branch, "name", locale) });
  return (
    <button
      type="button"
      onClick={openChooser}
      className={cn(
        "inline-flex h-11 min-w-0 items-center gap-2 rounded-full border border-input bg-card px-4 text-sm font-semibold hover:border-brand-amber",
        className,
      )}
      data-testid="order-chip"
    >
      <Icon className="size-4 shrink-0 text-brand-amber" aria-hidden />
      <span className="truncate sm:hidden">{short}</span>
      <span className="hidden truncate sm:inline">{label}</span>
      <span className="sr-only">· {t("change")}</span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

/** Wider card version for the cart and checkout. */
export function OrderStartCard() {
  const t = useTranslations("start");
  const locale = useLocale() as Locale;
  const { start, openChooser } = useOrderStart();
  const Icon = start?.type === "pickup" ? Store : Bike;
  return (
    <div className="flex items-center gap-3 rounded-[1.25rem] border border-border bg-card p-4">
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-black"
        style={{ backgroundImage: "var(--brand-gradient)" }}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="grid min-w-0 flex-1">
        <strong className="text-base">
          {!start
            ? t("chooseHow")
            : start.type === "delivery"
              ? t("deliveryTo", {
                  area: `${localized(start.area, "name", locale)}${locale === "ar" ? "، " : ", "}${localized(start.area, "city", locale)}`,
                })
              : t("pickupFrom", { branch: localized(start.branch, "name", locale) })}
        </strong>
        {start?.type === "delivery" ? (
          <span className="text-sm text-muted-foreground">{t("routedHint")}</span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={openChooser}
        className="h-11 shrink-0 rounded-full px-3 font-bold text-brand-amber hover:underline"
      >
        {t("change")}
      </button>
    </div>
  );
}

/** "Order now": asks delivery or pickup first if the visitor has not chosen yet. */
export function StartOrderButton({ label, className }: { label: string; className?: string }) {
  const { start, openChooser } = useOrderStart();
  const cls = cn(
    "btn-brand inline-flex h-14 items-center justify-center px-8 text-base",
    className,
  );
  return start ? (
    <Link href="/menu" className={cls}>
      {label}
    </Link>
  ) : (
    <button type="button" onClick={openChooser} className={cls}>
      {label}
    </button>
  );
}
