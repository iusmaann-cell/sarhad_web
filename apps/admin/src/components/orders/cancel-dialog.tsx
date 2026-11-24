"use client";

import { Button, Textarea } from "@sarhad/ui";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

const REASONS = ["soldOut", "closing", "noDriver", "customerAsked"] as const;

/** Asks for a reason before cancelling. The customer sees the reason. */
export function CancelDialog({
  orderNumber,
  pending,
  onConfirm,
  size = "sm",
}: {
  orderNumber: number;
  pending: boolean;
  onConfirm: (reason: string) => void;
  size?: "sm" | "default";
}) {
  const t = useTranslations("ops");
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const missing = reason.trim() === "";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size}
        className="text-destructive"
        disabled={pending}
        onClick={() => {
          setReason("");
          setTried(false);
          dialog.current?.showModal();
        }}
      >
        {t("cancel")}
      </Button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
        aria-label={t("cancel")}
      >
        <form
          className="grid gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (missing) return;
            dialog.current?.close();
            onConfirm(reason.trim());
          }}
        >
          <h2 className="text-lg font-semibold">
            {t("cancel")} · {t("orderNumber", { number: orderNumber })}
          </h2>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className="rounded-full border px-3 py-1 text-sm hover:bg-muted"
                onClick={() => setReason(t(`reasons.${r}`))}
              >
                {t(`reasons.${r}`)}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">{t("cancelReason")}</span>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 300))}
              rows={2}
              aria-invalid={tried && missing}
            />
            <span className={tried && missing ? "text-destructive" : "text-muted-foreground"}>
              {tried && missing ? t("errors.reason_required") : t("cancelReasonHint")}
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>
              {t("keepOrder")}
            </Button>
            <Button type="submit" variant="destructive">
              {t("cancel")}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
