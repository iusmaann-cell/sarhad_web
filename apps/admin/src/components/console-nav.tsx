"use client";

import { Badge, cn } from "@sarhad/ui";
import {
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  Settings,
  Store,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type Item = {
  href: string;
  key: "dashboard" | "orders" | "menu" | "branches" | "deliveryZones" | "staff" | "settings";
  icon: typeof Store;
  /** Not built yet: shown greyed out with a "coming soon" badge. */
  soon?: boolean;
  adminOnly?: boolean;
};

const ITEMS: Item[] = [
  { href: "/", key: "dashboard", icon: LayoutDashboard },
  { href: "/orders", key: "orders", icon: ClipboardList, soon: true },
  { href: "/menu", key: "menu", icon: UtensilsCrossed },
  { href: "/branches", key: "branches", icon: Store },
  { href: "/zones", key: "deliveryZones", icon: MapPinned },
  { href: "/staff", key: "staff", icon: Users },
  { href: "/settings", key: "settings", icon: Settings, soon: true, adminOnly: true },
];

export function ConsoleNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const pathname = usePathname();

  return (
    <nav className="grid gap-1">
      {ITEMS.filter((i) => isAdmin || !i.adminOnly).map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        const content = (
          <>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{t(item.key)}</span>
            {item.soon ? <Badge variant="muted">{tc("comingSoon")}</Badge> : null}
          </>
        );
        const cls = cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
          active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          item.soon && "pointer-events-none opacity-60",
        );
        return item.soon ? (
          <span key={item.key} className={cls} aria-disabled>
            {content}
          </span>
        ) : (
          <Link
            key={item.key}
            href={item.href}
            className={cls}
            aria-current={active ? "page" : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
