import type { DeliveryAreaOption } from "@sarhad/core";

/** Cookie holding the visitor's choice: "d:<area id>" or "p:<branch slug>". */
export const ORDER_START_COOKIE = "sarhad_order";

export type StartBranch = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  address_en: string | null;
  address_ar: string | null;
  open: boolean;
};

export type OrderStart =
  { type: "delivery"; area: DeliveryAreaOption } | { type: "pickup"; branch: StartBranch };

export function encodeOrderStart(start: OrderStart): string {
  return start.type === "delivery" ? `d:${start.area.area_id}` : `p:${start.branch.slug}`;
}

/** Resolve the saved choice against today's areas and branches; null if gone. */
export function decodeOrderStart(
  raw: string | undefined | null,
  areas: DeliveryAreaOption[],
  branches: StartBranch[],
): OrderStart | null {
  if (!raw) return null;
  const [kind, value] = [raw.slice(0, 1), raw.slice(2)];
  if (kind === "d") {
    const area = areas.find((a) => a.area_id === value);
    return area ? { type: "delivery", area } : null;
  }
  if (kind === "p") {
    const branch = branches.find((b) => b.slug === value);
    return branch ? { type: "pickup", branch } : null;
  }
  return null;
}

/** The branch whose menu and prices apply to this choice. */
export function orderStartBranchId(start: OrderStart | null): string | null {
  if (!start) return null;
  return start.type === "delivery" ? start.area.branch_id : start.branch.id;
}
