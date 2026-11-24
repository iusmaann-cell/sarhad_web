"use client";

import { nextStatuses, type OrderStatus, type OrderType } from "@sarhad/core";
import { Button } from "@sarhad/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { changeOrderStatus } from "@/app/(console)/orders/actions";

import { CancelDialog } from "./cancel-dialog";

type Forward = Exclude<OrderStatus, "pending" | "cancelled">;

/** The next-step button and Cancel for one order. */
export function StatusActions({
  orderId,
  orderNumber,
  type,
  status,
  onChanged,
  size = "sm",
}: {
  orderId: string;
  orderNumber: number;
  type: OrderType;
  status: OrderStatus;
  /** Called after a successful change; without it the page is refreshed. */
  onChanged?: (status: OrderStatus) => void;
  size?: "sm" | "default";
}) {
  const t = useTranslations("ops");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = nextStatuses(type, status);
  const forward = options.find((s): s is Forward => s !== "cancelled");

  function run(next: OrderStatus, reason?: string) {
    setError(null);
    startTransition(async () => {
      const res = await changeOrderStatus(orderId, next, reason);
      if (res.ok) {
        if (onChanged) onChanged(res.status);
        else router.refresh();
      } else {
        setError(res.error);
        router.refresh();
      }
    });
  }

  if (!options.length) return null;

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {forward ? (
          <Button type="button" size={size} disabled={pending} onClick={() => run(forward)}>
            {t(`action.${forward}`)}
          </Button>
        ) : null}
        <CancelDialog
          orderNumber={orderNumber}
          pending={pending}
          size={size}
          onConfirm={(reason) => run("cancelled", reason)}
        />
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {t(`errors.${error as "unknown"}`)}
        </p>
      ) : null}
    </div>
  );
}
