"use client";

import {
  formatPrice,
  invalidModifierGroups,
  itemTotalFils,
  makeCartLine,
  MAX_LINE_QUANTITY,
  type MenuItem,
} from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Button, Textarea } from "@sarhad/ui";
import { Minus, Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useCart } from "@/components/cart/cart-provider";
import { Link } from "@/i18n/navigation";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  const t = useTranslations("menu");
  return (
    <div className="inline-flex items-center rounded-full border">
      <button
        type="button"
        className="flex size-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={t("decrease")}
      >
        <Minus className="size-4" />
      </button>
      <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="flex size-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_LINE_QUANTITY}
        aria-label={t("increase")}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function AddToCart({ item, branchId }: { item: MenuItem; branchId: string }) {
  const t = useTranslations("menu");
  const locale = useLocale() as Locale;
  const { cart, add } = useCart();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [tried, setTried] = useState(false);
  const [added, setAdded] = useState(false);

  if (!item.is_available) return null;

  const name = localized(item, "name", locale);
  const invalid = invalidModifierGroups(item, selected);
  const total = itemTotalFils(item, selected) * quantity;
  const otherBranch = cart.branchId !== null && cart.branchId !== branchId && cart.lines.length > 0;

  function open() {
    setSelected(
      // Pre-select the first option of required single-choice groups.
      item.modifier_groups
        .filter((g) => g.min_select === 1 && g.max_select === 1 && g.options[0])
        .map((g) => g.options[0]!.id),
    );
    setQuantity(1);
    setNotes("");
    setTried(false);
    setAdded(false);
    dialog.current?.showModal();
  }

  function toggle(groupId: string, optionId: string, single: boolean) {
    const group = item.modifier_groups.find((g) => g.id === groupId)!;
    const groupIds = group.options.map((o) => o.id);
    setSelected((prev) => {
      if (single) return [...prev.filter((id) => !groupIds.includes(id)), optionId];
      if (prev.includes(optionId)) return prev.filter((id) => id !== optionId);
      const inGroup = prev.filter((id) => groupIds.includes(id)).length;
      return inGroup >= group.max_select ? prev : [...prev, optionId];
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (invalid.length) return;
    add(branchId, makeCartLine(item, selected, quantity, notes));
    setAdded(true);
    window.setTimeout(() => dialog.current?.close(), 900);
  }

  // Simple dishes go straight to the cart.
  const simple = item.modifier_groups.length === 0;

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          if (simple && !otherBranch) {
            add(branchId, makeCartLine(item, [], 1));
            setAdded(true);
            window.setTimeout(() => setAdded(false), 1500);
          } else open();
        }}
        aria-label={`${t("add")}: ${name}`}
      >
        <Plus /> {added && simple ? t("added") : t("add")}
      </Button>

      <dialog
        ref={dialog}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
        aria-label={name}
      >
        <form onSubmit={submit} className="grid max-h-[85vh] grid-rows-[auto_1fr_auto]">
          <div className="flex items-start justify-between gap-4 border-b p-4">
            <div>
              <h2 className="text-lg font-semibold">{name}</h2>
              <p className="text-sm tabular-nums text-muted-foreground">
                {formatPrice(item.price_fils, locale)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="rounded-md p-1 hover:bg-muted"
              aria-label={t("close")}
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="grid gap-5 overflow-y-auto p-4">
            {otherBranch ? (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                {t("otherBranchCart")}
              </p>
            ) : null}
            {item.modifier_groups.map((g) => {
              const single = g.max_select === 1;
              const groupName = localized(g, "name", locale);
              const bad = tried && invalid.includes(g.id);
              return (
                <fieldset key={g.id} className="grid gap-2">
                  <legend className="mb-1 flex w-full items-center justify-between gap-2">
                    <span className="font-medium">{groupName}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.min_select > 0 ? `${t("required")} · ` : ""}
                      {g.min_select === g.max_select
                        ? t("choose", { count: g.max_select })
                        : t("chooseUpTo", { count: g.max_select })}
                    </span>
                  </legend>
                  {g.options.map((o) => (
                    <label
                      key={o.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-secondary"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type={single ? "radio" : "checkbox"}
                          name={`g-${g.id}`}
                          checked={selected.includes(o.id)}
                          onChange={() => toggle(g.id, o.id, single)}
                          className="size-4 accent-[var(--color-primary)]"
                        />
                        {localized(o, "name", locale)}
                      </span>
                      {o.price_delta_fils > 0 ? (
                        <span className="text-sm tabular-nums text-muted-foreground">
                          +{formatPrice(o.price_delta_fils, locale)}
                        </span>
                      ) : null}
                    </label>
                  ))}
                  {bad ? (
                    <p className="text-sm text-destructive" role="alert">
                      {t("chooseRequired", { group: groupName })}
                    </p>
                  ) : null}
                </fieldset>
              );
            })}
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{t("itemNotes")}</span>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                placeholder={t("itemNotesHint")}
                rows={2}
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 border-t p-4">
            <QuantityStepper value={quantity} onChange={setQuantity} />
            {added ? (
              <Button asChild variant="outline">
                <Link href="/cart">{t("viewCart")}</Link>
              </Button>
            ) : (
              <Button type="submit" className="flex-1">
                {t("addToCartTotal", { total: formatPrice(total, locale) })}
              </Button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
