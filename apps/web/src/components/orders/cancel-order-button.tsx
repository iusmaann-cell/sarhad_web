"use client";

import { Button } from "@sarhad/ui";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { cancelOrder } from "@/app/[locale]/orders/actions";
import { useRouter } from "@/i18n/navigation";

export function CancelOrderButton({ id }: { id: string }) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!confirm(t("confirmCancel"))) return;
          start(async () => {
            const res = await cancelOrder(id);
            setFailed(!res.ok);
            router.refresh();
          });
        }}
      >
        {t("cancel")}
      </Button>
      {failed ? <p className="text-sm text-destructive">{t("cannotCancel")}</p> : null}
    </div>
  );
}
