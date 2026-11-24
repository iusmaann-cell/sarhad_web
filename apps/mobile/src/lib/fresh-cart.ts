import { refreshCart, type BranchMenu } from "@sarhad/core";
import { useEffect, useState } from "react";

import { useCart } from "./cart";
import { supabase } from "./supabase";

export type CartBranch = {
  id: string;
  name_en: string;
  name_ar: string;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  open: boolean;
};

/** Re-price the saved cart against the branch's live menu once per screen. */
export function useFreshCart() {
  const { cart, ready, replace } = useCart();
  const [branch, setBranch] = useState<CartBranch | null>(null);
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  const [removed, setRemoved] = useState(0);
  const branchId = cart.branchId;

  useEffect(() => {
    if (!ready || !branchId || checkedFor === branchId) return;
    let cancelled = false;
    (async () => {
      const [{ data: b }, { data: menu }, { data: open }] = await Promise.all([
        supabase
          .from("branches")
          .select("id, name_en, name_ar, accepts_delivery, accepts_pickup, accepting_orders")
          .eq("id", branchId)
          .eq("is_active", true)
          .maybeSingle(),
        supabase.rpc("get_branch_menu", { p_branch_id: branchId }),
        supabase.rpc("branch_is_open", { p_branch_id: branchId }),
      ]);
      if (cancelled) return;
      setCheckedFor(branchId);
      if (!b) {
        setRemoved(cart.lines.length);
        replace({ branchId: null, lines: [] });
        return;
      }
      setBranch({ ...b, open: !!open && b.accepting_orders });
      const items = ((menu ?? []) as unknown as BranchMenu).flatMap((c) => c.items);
      const fresh = refreshCart(cart, items);
      setRemoved(fresh.removed);
      replace(fresh.cart);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, branchId]);

  return { cart, branch, removed, checked: ready && (!branchId || checkedFor === branchId) };
}
