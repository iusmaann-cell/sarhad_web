import { describe, expect, it } from "vitest";
import {
  amountToMinimum,
  areaContains,
  fromZoneArea,
  toZoneArea,
  zoneSchema,
  type LngLat,
} from "./zones";

const square: LngLat[][] = [
  [
    [47.9, 29.3],
    [48.0, 29.3],
    [48.0, 29.4],
    [47.9, 29.4],
    [47.9, 29.3],
  ],
];

const valid = {
  branchId: "9602b707-974d-4bba-9ef2-c674e61e8c08",
  nameEn: "Kuwait City",
  nameAr: "مدينة الكويت",
  fee: "0.500",
  minOrder: "3",
  etaMinutes: "35",
  color: "#c2410c",
  isActive: true,
  area: { type: "Polygon", coordinates: square },
};

describe("delivery zones", () => {
  it("accepts a drawn zone and converts money to fils", () => {
    const r = zoneSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.fee).toBe(500);
      expect(r.data.minOrder).toBe(3000);
      expect(r.data.etaMinutes).toBe(35);
    }
  });

  it("requires an area on the map", () => {
    const r = zoneSchema.safeParse({ ...valid, area: null });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("drawArea");
  });

  it("rejects open rings, too few corners and bad times", () => {
    const open = [square[0]!.slice(0, 4)];
    expect(
      zoneSchema.safeParse({ ...valid, area: { type: "Polygon", coordinates: open } }).success,
    ).toBe(false);
    const line: LngLat[][] = [
      [
        [1, 1],
        [2, 2],
        [1, 1],
        [1, 1],
      ],
    ];
    expect(
      zoneSchema.safeParse({ ...valid, area: { type: "Polygon", coordinates: line } }).success,
    ).toBe(false);
    expect(zoneSchema.safeParse({ ...valid, etaMinutes: "2" }).success).toBe(false);
    expect(zoneSchema.safeParse({ ...valid, fee: "abc" }).success).toBe(false);
  });

  it("merges drawn polygons and splits them back", () => {
    expect(toZoneArea([])).toBeNull();
    expect(toZoneArea([square])?.type).toBe("Polygon");
    const two = toZoneArea([square, square]);
    expect(two?.type).toBe("MultiPolygon");
    expect(fromZoneArea(two)).toHaveLength(2);
  });

  it("checks whether a point is inside", () => {
    const area = toZoneArea([square])!;
    expect(areaContains(area, [47.95, 29.35])).toBe(true);
    expect(areaContains(area, [48.05, 29.35])).toBe(false);
  });

  it("works out the amount left to reach the minimum order", () => {
    expect(amountToMinimum(2000, 3000)).toBe(1000);
    expect(amountToMinimum(3500, 3000)).toBe(0);
  });
});
