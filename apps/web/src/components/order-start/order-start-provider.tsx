"use client";

import type { DeliveryAreaOption } from "@sarhad/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useCart } from "@/components/cart/cart-provider";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  encodeOrderStart,
  ORDER_START_COOKIE,
  orderStartBranchId,
  type OrderStart,
  type StartBranch,
} from "@/lib/order-start-shared";

import { OrderStartDialog } from "./order-start-dialog";

type Ctx = {
  start: OrderStart | null;
  /** Branch whose menu applies to the current choice. */
  branchId: string | null;
  openChooser: () => void;
};

const OrderStartCtx = createContext<Ctx | null>(null);

/** Pages where the chooser does not pop up on its own. */
const QUIET_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/orders",
  "/pay",
  "/account",
];

function saveCookie(start: OrderStart) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${ORDER_START_COOKIE}=${encodeURIComponent(encodeOrderStart(start))}; path=/; max-age=${oneYear}; samesite=lax`;
}

export function OrderStartProvider({
  initial,
  areas,
  branches,
  children,
}: {
  initial: OrderStart | null;
  areas: DeliveryAreaOption[];
  branches: StartBranch[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { cart, ready, replace } = useCart();
  const [start, setStart] = useState<OrderStart | null>(initial);
  const [open, setOpen] = useState(false);

  // First visit: ask delivery or pickup before anything else.
  useEffect(() => {
    if (start || QUIET_PATHS.some((p) => pathname.startsWith(p))) return;
    // Opening the dialog has to wait for the browser (it is a modal <dialog>).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
    // Only on arrival, not on every page change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The cart follows the branch that will make the order; prices are checked again there.
  const startBranchId = orderStartBranchId(start);
  useEffect(() => {
    if (ready && startBranchId && cart.lines.length > 0 && cart.branchId !== startBranchId) {
      replace({ branchId: startBranchId, lines: cart.lines });
    }
  }, [ready, startBranchId, cart, replace]);

  const choose = useCallback(
    (next: OrderStart) => {
      saveCookie(next);
      setStart(next);
      setOpen(false);
      if (pathname === "/menu" || pathname === "/cart" || pathname === "/checkout") {
        router.refresh();
      } else {
        router.push("/menu");
      }
    },
    [pathname, router],
  );

  const value = useMemo<Ctx>(
    () => ({ start, branchId: orderStartBranchId(start), openChooser: () => setOpen(true) }),
    [start],
  );

  return (
    <OrderStartCtx.Provider value={value}>
      {children}
      <OrderStartDialog
        open={open}
        onClose={() => setOpen(false)}
        areas={areas}
        branches={branches}
        current={start}
        onChoose={choose}
      />
    </OrderStartCtx.Provider>
  );
}

export function useOrderStart(): Ctx {
  const ctx = useContext(OrderStartCtx);
  if (!ctx) throw new Error("useOrderStart must be used inside OrderStartProvider");
  return ctx;
}
