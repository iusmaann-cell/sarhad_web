"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect } from "react";

/** Refreshes the page data every 15 seconds while the order is in progress. */
export function OrderLive({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    return () => window.clearInterval(id);
  }, [active, router]);
  return null;
}
