import { describe, expect, it } from "vitest";

import {
  branchSchema,
  filsToKwd,
  invalidModifierGroups,
  isOpenAt,
  itemTotalFils,
  menuImageUrl,
  menuItemSchema,
  parseKwd,
  slugify,
  toPointWkt,
  type MenuItem,
} from "./index";

describe("money", () => {
  it("parses KWD input into fils", () => {
    expect(parseKwd("2.250")).toBe(2250);
    expect(parseKwd("2")).toBe(2000);
    expect(parseKwd("0.5")).toBe(500);
    expect(parseKwd("٢٫٥")).toBe(2500);
    expect(parseKwd("1.2345")).toBeNull();
    expect(parseKwd("-1")).toBeNull();
    expect(parseKwd("abc")).toBeNull();
  });

  it("formats fils for inputs", () => {
    expect(filsToKwd(2250)).toBe("2.250");
  });
});

const karahi: MenuItem = {
  id: "i1",
  name_en: "Karahi",
  name_ar: "كراهي",
  description_en: null,
  description_ar: null,
  image_path: null,
  calories: null,
  is_featured: false,
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
    {
      id: "extras",
      name_en: "Extras",
      name_ar: "إضافات",
      min_select: 0,
      max_select: 1,
      options: [{ id: "butter", name_en: "Butter", name_ar: "زبدة", price_delta_fils: 250 }],
    },
  ],
};

describe("items", () => {
  it("adds option prices", () => {
    expect(itemTotalFils(karahi, ["full", "butter"])).toBe(6250);
  });

  it("checks required choices", () => {
    expect(invalidModifierGroups(karahi, [])).toEqual(["size"]);
    expect(invalidModifierGroups(karahi, ["half", "full"])).toEqual(["size"]);
    expect(invalidModifierGroups(karahi, ["half"])).toEqual([]);
  });

  it("validates the item form", () => {
    const base = {
      categoryId: "11111111-1111-4111-8111-111111111111",
      nameEn: "Naan",
      nameAr: "نان",
      price: "0.250",
    };
    const ok = menuItemSchema.parse(base);
    expect(ok.price).toBe(250);
    expect(ok.calories).toBeNull();
    expect(menuItemSchema.safeParse({ ...base, price: "x" }).success).toBe(false);
    const badGroup = menuItemSchema.safeParse({
      ...base,
      modifierGroups: [
        {
          nameEn: "S",
          nameAr: "S",
          minSelect: 2,
          maxSelect: 1,
          options: [{ nameEn: "a", nameAr: "a", price: "0" }],
        },
      ],
    });
    expect(badGroup.success).toBe(false);
  });

  it("builds image URLs", () => {
    expect(menuImageUrl("http://x.co/", "a/b.jpg")).toBe(
      "http://x.co/storage/v1/object/public/menu-images/a/b.jpg",
    );
    expect(menuImageUrl("http://x.co", "https://cdn/x.jpg")).toBe("https://cdn/x.jpg");
    expect(menuImageUrl("http://x.co", null)).toBeNull();
  });
});

describe("branches", () => {
  // 2026-11-25 is a Wednesday. Kuwait is UTC+3.
  const at = (iso: string) => new Date(iso);
  const hours = {
    wed: [{ open: "11:00", close: "23:00" }],
    thu: [{ open: "11:00", close: "01:00" }],
  };

  it("knows when a branch is open", () => {
    expect(isOpenAt(hours, at("2026-11-25T09:00:00Z"))).toBe(true); // 12:00 Wed
    expect(isOpenAt(hours, at("2026-11-25T07:00:00Z"))).toBe(false); // 10:00 Wed
    expect(isOpenAt(hours, at("2026-11-25T20:30:00Z"))).toBe(false); // 23:30 Wed
  });

  it("handles closing after midnight", () => {
    expect(isOpenAt(hours, at("2026-11-26T21:30:00Z"))).toBe(true); // 00:30 Fri, from Thu
    expect(isOpenAt(hours, at("2026-11-26T22:30:00Z"))).toBe(false); // 01:30 Fri
  });

  it("makes slugs", () => {
    expect(slugify("Salmiya Branch")).toBe("salmiya-branch");
    expect(slugify("  Kuwait City -- 2 ")).toBe("kuwait-city-2");
  });

  it("validates the branch form", () => {
    const base = {
      nameEn: "Salmiya",
      nameAr: "السالمية",
      slug: "salmiya",
      isActive: true,
      acceptsDelivery: true,
      acceptsPickup: false,
      openingHours: { sat: [{ open: "11:00", close: "23:00" }] },
    };
    expect(branchSchema.safeParse(base).success).toBe(true);
    expect(branchSchema.safeParse({ ...base, latitude: "29.3" }).success).toBe(false);
    expect(branchSchema.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(false);
    expect(
      branchSchema.safeParse({ ...base, openingHours: { sat: [{ open: "25:00", close: "1" }] } })
        .success,
    ).toBe(false);
    expect(toPointWkt(29.3, 47.9)).toBe("SRID=4326;POINT(47.9 29.3)");
  });
});
