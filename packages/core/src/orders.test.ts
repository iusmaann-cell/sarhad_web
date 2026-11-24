import { describe, expect, it } from "vitest";

import type { MenuItem } from "./menu";
import {
  addToCart,
  cartCount,
  cartSubtotal,
  cartToOrderItems,
  checkoutSchema,
  EMPTY_CART,
  formatAddress,
  makeCartLine,
  nextStatuses,
  orderErrorCode,
  refreshCart,
  setLineQuantity,
} from "./orders";

const karahi: MenuItem = {
  id: "karahi",
  name_en: "Chicken Karahi",
  name_ar: "كراهي دجاج",
  description_en: null,
  description_ar: null,
  image_path: null,
  calories: null,
  is_featured: true,
  price_fils: 3500,
  is_available: true,
  modifier_groups: [
    {
      id: "size",
      name_en: "Size",
      name_ar: "الحجم",
      min_select: 1,
      max_select: 1,
      options: [
        { id: "half", name_en: "Half", name_ar: "نصف", price_delta_fils: 0 },
        { id: "full", name_en: "Full", name_ar: "كامل", price_delta_fils: 2500 },
      ],
    },
  ],
};

describe("cart", () => {
  it("adds lines, merges the same choice and totals in fils", () => {
    let cart = addToCart(EMPTY_CART, "main", makeCartLine(karahi, ["full"], 1));
    cart = addToCart(cart, "main", makeCartLine(karahi, ["full"], 2));
    cart = addToCart(cart, "main", makeCartLine(karahi, ["half"], 1));
    expect(cart.lines).toHaveLength(2);
    expect(cartCount(cart)).toBe(4);
    expect(cartSubtotal(cart)).toBe(6000 * 3 + 3500);
    expect(cartToOrderItems(cart)[0]).toEqual({
      item_id: "karahi",
      quantity: 3,
      option_ids: ["full"],
      notes: undefined,
    });
  });

  it("starts a new cart when the branch changes", () => {
    const cart = addToCart(EMPTY_CART, "main", makeCartLine(karahi, ["full"], 1));
    const other = addToCart(cart, "salmiya", makeCartLine(karahi, ["half"], 1));
    expect(other.branchId).toBe("salmiya");
    expect(other.lines).toHaveLength(1);
  });

  it("changes and removes quantities", () => {
    const cart = addToCart(EMPTY_CART, "main", makeCartLine(karahi, ["full"], 1));
    const key = cart.lines[0]!.key;
    expect(setLineQuantity(cart, key, 99).lines[0]!.quantity).toBe(50);
    const empty = setLineQuantity(cart, key, 0);
    expect(empty.lines).toHaveLength(0);
    expect(empty.branchId).toBeNull();
  });

  it("re-prices a saved cart and drops what is no longer orderable", () => {
    const cart = addToCart(EMPTY_CART, "main", makeCartLine(karahi, ["full"], 1));
    const pricier = { ...karahi, price_fils: 4000 };
    expect(refreshCart(cart, [pricier]).cart.lines[0]!.unitPriceFils).toBe(6500);
    expect(refreshCart(cart, [{ ...karahi, is_available: false }]).removed).toBe(1);
    expect(refreshCart(cart, []).cart.lines).toHaveLength(0);
  });
});

describe("checkout", () => {
  const address = {
    area: "Salmiya",
    block: "10",
    street: "5",
    building: "12",
    latitude: 29.33,
    longitude: 48.07,
  };

  it("accepts pickup and delivery and normalises the phone", () => {
    const r = checkoutSchema.safeParse({ type: "pickup", name: "Ali", phone: "5000 0000" });
    expect(r.success && r.data.phone).toBe("+96550000000");
    expect(
      checkoutSchema.safeParse({ type: "delivery", name: "Ali", phone: "50000000", address })
        .success,
    ).toBe(true);
  });

  it("requires the address parts and the map pin for delivery", () => {
    const r = checkoutSchema.safeParse({
      type: "delivery",
      name: "Ali",
      phone: "50000000",
      address: { ...address, block: "", latitude: undefined },
    });
    expect(r.success).toBe(false);
    const messages = r.error!.issues.map((i) => i.message);
    expect(messages).toContain("required");
    expect(messages).toContain("pinRequired");
  });

  it("formats a Kuwaiti address", () => {
    const labels = {
      block: "Block",
      street: "Street",
      avenue: "Avenue",
      building: "Building",
      floor: "Floor",
      apartment: "Apt",
    };
    expect(formatAddress(address, labels)).toBe("Salmiya, Block 10, Street 5, Building 12");
  });

  it("maps server error codes", () => {
    expect(orderErrorCode("outside_zone")).toBe("outside_zone");
    expect(orderErrorCode("something else")).toBe("unknown");
  });
});

describe("order status", () => {
  it("moves through the steps for each order type", () => {
    expect(nextStatuses("pickup", "ready")).toEqual(["completed", "cancelled"]);
    expect(nextStatuses("delivery", "ready")).toEqual(["out_for_delivery", "cancelled"]);
    expect(nextStatuses("delivery", "completed")).toEqual([]);
  });
});
