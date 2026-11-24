"use client";

import { filsToKwd, parseKwd } from "@sarhad/core";
import { Button, Input } from "@sarhad/ui";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { ActionResult } from "@/lib/action-result";

import { setAvailability } from "../actions";

type AdminKey = Parameters<ReturnType<typeof useTranslations<"admin">>>[0];

export function AvailabilityRow(props: {
  branchId: string;
  itemId: string;
  name: string;
  basePrice: string;
  available: boolean;
  priceOverrideFils: number | null;
  canPrice: boolean;
}) {
  const t = useTranslations("admin");
  const tv = useTranslations("validation");
  const tm = useTranslations("menu");
  const [available, setAvailable] = useState(props.available);
  const [price, setPrice] = useState(
    props.priceOverrideFils === null ? "" : filsToKwd(props.priceOverrideFils),
  );
  const [result, setResult] = useState<ActionResult | null>(null);
  const [priceError, setPriceError] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(nextAvailable: boolean, nextPrice: string) {
    const fils = nextPrice.trim() === "" ? null : parseKwd(nextPrice);
    if (nextPrice.trim() !== "" && fils === null) {
      setPriceError(true);
      return;
    }
    setPriceError(false);
    startTransition(async () => {
      const res = await setAvailability(
        props.branchId,
        props.itemId,
        nextAvailable,
        props.canPrice ? fils : props.priceOverrideFils,
      );
      setResult(res);
      if (!res.ok) setAvailable(props.available);
    });
  }

  return (
    <tr className="border-t">
      <td className="p-3 font-medium">{props.name}</td>
      <td className="p-3 tabular-nums text-muted-foreground">{props.basePrice}</td>
      <td className="p-3">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="size-5 accent-[var(--color-primary)]"
            checked={available}
            disabled={pending}
            aria-label={`${t("available")}: ${props.name}`}
            onChange={(e) => {
              setAvailable(e.target.checked);
              save(e.target.checked, price);
            }}
          />
          <span className={available ? "text-success" : "text-destructive"}>
            {available ? t("available") : tm("soldOut")}
          </span>
        </label>
      </td>
      {props.canPrice ? (
        <td className="p-3">
          <div className="flex items-center gap-2">
            <Input
              className="w-28"
              dir="ltr"
              inputMode="decimal"
              placeholder="-"
              value={price}
              aria-label={`${t("branchPrice")}: ${props.name}`}
              aria-invalid={priceError}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={() =>
                price !==
                  (props.priceOverrideFils === null ? "" : filsToKwd(props.priceOverrideFils)) &&
                save(available, price)
              }
            />
            {price ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPrice("");
                  save(available, "");
                }}
              >
                {t("resetPrice")}
              </Button>
            ) : null}
          </div>
          {priceError ? <p className="text-xs text-destructive">{tv("invalidPrice")}</p> : null}
        </td>
      ) : null}
      <td className="p-3 text-xs" aria-live="polite">
        {result?.message ? (
          <span className={result.ok ? "text-success" : "text-destructive"}>
            {t(result.message as AdminKey)}
          </span>
        ) : null}
      </td>
    </tr>
  );
}
