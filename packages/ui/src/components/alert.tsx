import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "../lib";

const alertVariants = cva("rounded-lg border px-4 py-3 text-sm", {
  variants: {
    variant: {
      default: "bg-card",
      success: "border-success/40 bg-success/10 text-success",
      destructive: "border-destructive/40 bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Alert({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
