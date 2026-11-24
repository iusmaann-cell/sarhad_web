"use client";

import { Button } from "@sarhad/ui";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { setAcceptingOrders } from "@/app/(console)/orders/actions";

/** Pause or resume online orders for a branch. */
export function PauseToggle({
  branchId,
  accepting,
  onChange,
}: {
  branchId: string;
  accepting: boolean;
  onChange: (accepting: boolean) => void;
}) {
  const t = useTranslations("ops");
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${accepting ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}
    >
      <span
        className={`size-2.5 rounded-full ${accepting ? "bg-success" : "bg-destructive"}`}
        aria-hidden
      />
      <div className="flex-1">
        <p className="font-medium">{accepting ? t("accepting") : t("paused")}</p>
        {!accepting ? <p className="text-xs text-muted-foreground">{t("pauseHint")}</p> : null}
      </div>
      <Button
        type="button"
        size="sm"
        variant={accepting ? "outline" : "default"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await setAcceptingOrders(branchId, !accepting);
            onChange(res.accepting);
          })
        }
      >
        {accepting ? t("pause") : t("resume")}
      </Button>
    </div>
  );
}
