"use server";

import type { MenuItem } from "@sarhad/core";

import { getBranches, getBranchMenu } from "@/lib/menu";

export type CartBranch = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  phone: string | null;
};

/** Current menu of the cart's branch, to re-price the saved cart. */
export async function loadCartMenu(
  branchId: string,
): Promise<{ branch: CartBranch; items: MenuItem[] } | null> {
  const branch = (await getBranches()).find((b) => b.id === branchId);
  if (!branch) return null;
  const menu = await getBranchMenu(branch.id);
  return {
    branch: {
      id: branch.id,
      slug: branch.slug,
      name_en: branch.name_en,
      name_ar: branch.name_ar,
      phone: branch.phone,
    },
    items: menu.flatMap((c) => c.items),
  };
}
