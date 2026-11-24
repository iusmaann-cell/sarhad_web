import type { BranchMenu, OpeningHours, Tables } from "@sarhad/core";
import { useEffect, useState } from "react";

import { isSupabaseConfigured, supabase } from "./supabase";

export type Branch = Pick<
  Tables<"branches">,
  | "id"
  | "slug"
  | "name_en"
  | "name_ar"
  | "address_en"
  | "address_ar"
  | "phone"
  | "whatsapp"
  | "latitude"
  | "longitude"
  | "timezone"
> & { opening_hours: OpeningHours };

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from("branches")
      .select(
        "id, slug, name_en, name_ar, address_en, address_ar, phone, whatsapp, latitude, longitude, timezone, opening_hours",
      )
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        setBranches(
          (data ?? []).map((b) => ({
            ...b,
            opening_hours: (b.opening_hours ?? {}) as OpeningHours,
          })),
        );
        setLoading(false);
      });
  }, []);
  return { branches, loading };
}

export function useBranchMenu(branchId: string | undefined) {
  const [state, setState] = useState<{ branchId?: string; menu: BranchMenu }>({ menu: [] });
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    supabase.rpc("get_branch_menu", { p_branch_id: branchId }).then(({ data }) => {
      if (!cancelled) setState({ branchId, menu: (data ?? []) as unknown as BranchMenu });
    });
    return () => {
      cancelled = true;
    };
  }, [branchId]);
  const loading = !!branchId && state.branchId !== branchId;
  return { menu: loading ? [] : state.menu, loading };
}
