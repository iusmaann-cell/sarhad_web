"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the page from the server every few seconds while it is open. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
