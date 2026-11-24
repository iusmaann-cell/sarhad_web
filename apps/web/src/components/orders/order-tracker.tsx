import { orderSteps, type OrderStatus, type OrderType } from "@sarhad/core";
import { cn } from "@sarhad/ui";
import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function OrderTracker({ type, status }: { type: OrderType; status: OrderStatus }) {
  const t = await getTranslations("orderStatus");
  const steps = orderSteps(type);
  const current = steps.indexOf(status);
  return (
    <ol className="grid gap-3 sm:flex sm:gap-0" data-testid="order-tracker">
      {steps.map((s, i) => {
        const done = i < current || status === "completed";
        const now = i === current && status !== "completed";
        return (
          <li key={s} className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:text-center">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                now && "border-primary text-primary animate-pulse",
                !done && !now && "border-border text-muted-foreground",
              )}
              aria-current={now ? "step" : undefined}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn("text-sm", now ? "font-semibold" : "text-muted-foreground")}>
              {t(s)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
