import { localized, type Locale } from "@sarhad/i18n";
import Link from "next/link";

import type { BranchOption } from "@/lib/orders";

/** Branch switcher shown when a staff member works in more than one branch. */
export function BranchTabs({
  branches,
  current,
  locale,
  label,
  basePath,
}: {
  branches: BranchOption[];
  current: string;
  locale: Locale;
  label: string;
  basePath: string;
}) {
  if (branches.length < 2) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2 print:hidden">
      {branches.map((b) => (
        <Link
          key={b.id}
          href={`${basePath}?branch=${b.id}`}
          aria-current={b.id === current ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${b.id === current ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
        >
          <span
            className={`size-2 rounded-full ${b.accepting_orders ? "bg-success" : "bg-destructive"}`}
            aria-hidden
          />
          {localized(b, "name", locale)}
        </Link>
      ))}
    </nav>
  );
}
