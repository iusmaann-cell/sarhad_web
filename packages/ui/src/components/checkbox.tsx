import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib";

/** Checkbox with its label, using a native input for accessibility. */
export function Checkbox({
  label,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm", className)}>
      <input type="checkbox" className="size-4 accent-[var(--color-primary)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
