"use client";

import { refreshCart } from "@sarhad/core";
import { useEffect, useState } from "react";

import { loadCartMenu, type CartBranch } from "@/app/[locale]/cart/actions";

import { useCart } from "./cart-provider";

/**
 * Loads the cart's branch and re-prices the saved cart against today's menu
 * once per page view. Dishes that sold out or changed are dropped.
 */
export function useFreshCart() {
  const { cart, ready, replace } = useCart();
  const [branch, setBranch] = useState<CartBranch | null>(null);
  const [removed, setRemoved] = useState(0);
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  const branchId = cart.branchId;

  useEffect(() => {
    if (!ready || !branchId || checkedFor === branchId) return;
    let cancelled = false;
    loadCartMenu(branchId).then((res) => {
      if (cancelled) return;
      setCheckedFor(branchId);
      if (!res) {
        setRemoved(cart.lines.length);
        replace({ branchId: null, lines: [] });
        return;
      }
      setBranch(res.branch);
      const fresh = refreshCart(cart, res.items);
      setRemoved(fresh.removed);
      replace(fresh.cart);
    });
    return () => {
      cancelled = true;
    };
    // Re-check only when the branch changes, not on every quantity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, branchId]);

  return {
    cart,
    ready,
    branch,
    removed,
    checked: !branchId || checkedFor === branchId,
  };
}
