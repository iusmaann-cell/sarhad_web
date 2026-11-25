"use client";

import { Alert, Button } from "@sarhad/ui";
import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { payOrder } from "@/app/[locale]/orders/actions";

export function PayButton({ orderId, label }: { orderId: string; label: string }) {
  const t = useTranslations("orders");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        size="lg"
        disabled={pending}
        data-testid="pay-now"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await payOrder(orderId);
            if (res?.error) setError(res.error);
          })
        }
      >
        <CreditCard /> {pending ? t("redirectingToPay") : label}
      </Button>
      {error ? (
        <Alert variant="destructive">{t(`payError.${error}` as Parameters<typeof t>[0])}</Alert>
      ) : null}
    </div>
  );
}
