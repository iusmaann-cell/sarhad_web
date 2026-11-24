import { z } from "zod";

import type { Database } from "./database.types";
import { invalidModifierGroups, itemTotalFils, type MenuItem } from "./menu";
import { kuwaitPhoneSchema } from "./validation";

export type OrderType = Database["public"]["Enums"]["order_type"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
];

/** Statuses a customer sees as "in progress". */
export function isOpenOrder(status: OrderStatus): boolean {
  return status !== "completed" && status !== "cancelled";
}

/** The steps shown on the order tracker, in order, for each order type. */
export function orderSteps(type: OrderType): OrderStatus[] {
  return type === "delivery"
    ? ["pending", "accepted", "preparing", "ready", "out_for_delivery", "completed"]
    : ["pending", "accepted", "preparing", "ready", "completed"];
}

/** Where staff can move an order next (the server checks the same rules). */
export function nextStatuses(type: OrderType, status: OrderStatus): OrderStatus[] {
  if (status === "completed" || status === "cancelled") return [];
  const steps = orderSteps(type);
  const next = steps[steps.indexOf(status) + 1];
  return next ? [next, "cancelled"] : ["cancelled"];
}

// ---------------------------------------------------------------------------
// Cart (kept on the device until the order is placed)
// ---------------------------------------------------------------------------

export type CartLine = {
  /** Same dish with the same add-ons and note = same line. */
  key: string;
  itemId: string;
  nameEn: string;
  nameAr: string;
  imagePath: string | null;
  optionIds: string[];
  /** For display only; the server recalculates every price. */
  optionNames: { en: string; ar: string }[];
  unitPriceFils: number;
  quantity: number;
  notes: string;
};

export type Cart = { branchId: string | null; lines: CartLine[] };

export const EMPTY_CART: Cart = { branchId: null, lines: [] };
export const MAX_LINE_QUANTITY = 50;

export function cartLineKey(itemId: string, optionIds: readonly string[], notes = ""): string {
  return [itemId, [...optionIds].sort().join(","), notes.trim()].join("|");
}

/** Build a cart line from a menu item and the chosen add-ons. */
export function makeCartLine(
  item: MenuItem,
  optionIds: readonly string[],
  quantity: number,
  notes = "",
): CartLine {
  const options = item.modifier_groups.flatMap((g) => g.options);
  const chosen = options.filter((o) => optionIds.includes(o.id));
  return {
    key: cartLineKey(item.id, optionIds, notes),
    itemId: item.id,
    nameEn: item.name_en,
    nameAr: item.name_ar,
    imagePath: item.image_path,
    optionIds: chosen.map((o) => o.id),
    optionNames: chosen.map((o) => ({ en: o.name_en, ar: o.name_ar })),
    unitPriceFils: itemTotalFils(item, optionIds),
    quantity: clampQuantity(quantity),
    notes: notes.trim(),
  };
}

export function clampQuantity(n: number): number {
  return Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.round(n) || 1));
}

/** Add a line; switching branch starts a new cart (prices differ by branch). */
export function addToCart(cart: Cart, branchId: string, line: CartLine): Cart {
  const base = cart.branchId === branchId ? cart.lines : [];
  const existing = base.find((l) => l.key === line.key);
  const lines = existing
    ? base.map((l) =>
        l.key === line.key ? { ...l, quantity: clampQuantity(l.quantity + line.quantity) } : l,
      )
    : [...base, line];
  return { branchId, lines };
}

export function setLineQuantity(cart: Cart, key: string, quantity: number): Cart {
  const lines =
    quantity <= 0
      ? cart.lines.filter((l) => l.key !== key)
      : cart.lines.map((l) => (l.key === key ? { ...l, quantity: clampQuantity(quantity) } : l));
  return { branchId: lines.length ? cart.branchId : null, lines };
}

export function cartSubtotal(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.unitPriceFils * l.quantity, 0);
}

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.quantity, 0);
}

/**
 * Re-price a saved cart against the current branch menu. Lines whose dish is
 * gone, sold out or whose add-ons no longer fit are dropped.
 */
export function refreshCart(cart: Cart, items: MenuItem[]): { cart: Cart; removed: number } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const lines: CartLine[] = [];
  for (const line of cart.lines) {
    const item = byId.get(line.itemId);
    if (!item || !item.is_available) continue;
    const valid = item.modifier_groups.flatMap((g) => g.options).map((o) => o.id);
    if (line.optionIds.some((id) => !valid.includes(id))) continue;
    if (invalidModifierGroups(item, line.optionIds).length) continue;
    lines.push({ ...makeCartLine(item, line.optionIds, line.quantity, line.notes), key: line.key });
  }
  return {
    cart: { branchId: lines.length ? cart.branchId : null, lines },
    removed: cart.lines.length - lines.length,
  };
}

/** Lines in the shape place_order() expects. */
export function cartToOrderItems(cart: Cart) {
  return cart.lines.map((l) => ({
    item_id: l.itemId,
    quantity: l.quantity,
    option_ids: l.optionIds,
    notes: l.notes || undefined,
  }));
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

const req = (max: number) => z.string().trim().min(1, "required").max(max);
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const addressSchema = z.object({
  area: req(80),
  block: req(20),
  street: req(80),
  avenue: opt(40),
  building: req(40),
  floor: opt(20),
  apartment: opt(20),
  notes: opt(300),
  latitude: z.number({ message: "pinRequired" }).min(-90).max(90),
  longitude: z.number({ message: "pinRequired" }).min(-180).max(180),
});

export type AddressData = z.output<typeof addressSchema>;

export const checkoutSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("pickup"),
    name: z.string().trim().min(2, "nameTooShort").max(80),
    phone: kuwaitPhoneSchema,
    notes: opt(500),
  }),
  z.object({
    type: z.literal("delivery"),
    name: z.string().trim().min(2, "nameTooShort").max(80),
    phone: kuwaitPhoneSchema,
    notes: opt(500),
    address: addressSchema,
  }),
]);

export type CheckoutData = z.output<typeof checkoutSchema>;

/** Error codes raised by place_order(); each has a message in "checkout.errors". */
export const ORDER_ERROR_CODES = [
  "sign_in_required",
  "invalid_order",
  "branch_unavailable",
  "branch_closed",
  "type_unavailable",
  "contact_required",
  "cart_empty",
  "invalid_quantity",
  "item_unavailable",
  "invalid_options",
  "address_required",
  "outside_zone",
  "below_minimum",
] as const;

export type OrderErrorCode = (typeof ORDER_ERROR_CODES)[number] | "unknown";

export function orderErrorCode(message: string | undefined | null): OrderErrorCode {
  return (ORDER_ERROR_CODES as readonly string[]).includes(message ?? "")
    ? (message as OrderErrorCode)
    : "unknown";
}

export type OrderAddress = Partial<AddressData>;

/** One-line Kuwaiti address, e.g. "Salmiya, Block 10, Street 5, Building 12". */
export function formatAddress(
  a: OrderAddress | null | undefined,
  labels: {
    block: string;
    street: string;
    avenue: string;
    building: string;
    floor: string;
    apartment: string;
  },
): string {
  if (!a) return "";
  return [
    a.area,
    a.block && `${labels.block} ${a.block}`,
    a.street && `${labels.street} ${a.street}`,
    a.avenue && `${labels.avenue} ${a.avenue}`,
    a.building && `${labels.building} ${a.building}`,
    a.floor && `${labels.floor} ${a.floor}`,
    a.apartment && `${labels.apartment} ${a.apartment}`,
  ]
    .filter(Boolean)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Back office board
// ---------------------------------------------------------------------------

export type BoardColumn = "new" | "kitchen" | "ready";

export const BOARD_COLUMNS: BoardColumn[] = ["new", "kitchen", "ready"];

/** Which column of the live orders board an order sits in (null once it is closed). */
export function boardColumn(status: OrderStatus): BoardColumn | null {
  switch (status) {
    case "pending":
      return "new";
    case "accepted":
    case "preparing":
      return "kitchen";
    case "ready":
    case "out_for_delivery":
      return "ready";
    default:
      return null;
  }
}

/** Whole minutes since a time, never negative. */
export function minutesSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
}

/** Error codes from update_order_status(). */
export const STATUS_ERROR_CODES = ["not_found", "invalid_status", "reason_required"] as const;
export type StatusErrorCode = (typeof STATUS_ERROR_CODES)[number];

export function statusErrorCode(message: string | undefined): StatusErrorCode | "unknown" {
  const code = STATUS_ERROR_CODES.find((c) => message?.includes(c));
  return code ?? "unknown";
}
