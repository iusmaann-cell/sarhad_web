import { describe, expect, it } from "vitest";

import { normalizePromoCode, promoDiscount, promoLastDay, promoSchema } from "./promotions";

const base = {
  code: " ramadan 10 ",
  nameEn: "Ramadan",
  nameAr: "رمضان",
  kind: "percent" as const,
  value: "10",
  minSubtotal: "5",
  maxDiscount: "2.5",
  branchId: "",
  startsOn: "2026-12-01",
  endsOn: "2026-12-31",
  maxUses: "",
  maxUsesPerCustomer: "1",
  firstOrderOnly: false,
  isActive: true,
};

describe("promo codes", () => {
  it("normalises codes", () => {
    expect(normalizePromoCode(" eid 26 ")).toBe("EID26");
  });

  it("works out discounts like the server", () => {
    const pct = { kind: "percent" as const, value: 10, max_discount_fils: 1500 };
    expect(promoDiscount(pct, 8000, 0)).toBe(800);
    expect(promoDiscount(pct, 40000, 0)).toBe(1500);
    expect(promoDiscount({ kind: "fixed", value: 3000, max_discount_fils: null }, 2000, 0)).toBe(
      2000,
    );
    expect(
      promoDiscount({ kind: "free_delivery", value: 0, max_discount_fils: null }, 2000, 500),
    ).toBe(500);
  });

  it("turns the form into a database row", () => {
    const r = promoSchema.parse(base);
    expect(r.code).toBe("RAMADAN10");
    expect(r.value).toBe(10);
    expect(r.min_subtotal_fils).toBe(5000);
    expect(r.max_discount_fils).toBe(2500);
    expect(r.branch_id).toBeNull();
    expect(r.starts_at).toBe("2026-12-01T00:00:00+03:00");
    expect(r.ends_at).toBe("2026-12-31T21:00:00.000Z");
    expect(promoLastDay(r.ends_at!)).toBe("2026-12-31");
    expect(r.max_uses).toBeNull();
  });

  it("reads fixed amounts in KWD", () => {
    const r = promoSchema.parse({ ...base, kind: "fixed", value: "1.5" });
    expect(r.value).toBe(1500);
    expect(r.max_discount_fils).toBeNull();
  });

  it("rejects bad input", () => {
    expect(promoSchema.safeParse({ ...base, value: "150" }).success).toBe(false);
    expect(promoSchema.safeParse({ ...base, code: "a!" }).success).toBe(false);
    expect(promoSchema.safeParse({ ...base, endsOn: "2026-11-01" }).success).toBe(false);
  });
});
