import { z } from "zod";
import { kwdField } from "./menu";

/** Map center used when a branch has no pin yet (Kuwait City). */
export const KUWAIT_CENTER = { latitude: 29.3759, longitude: 47.9774 } as const;

/** Free vector map style (no API key). Override with NEXT_PUBLIC_MAP_STYLE_URL. */
export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export const ZONE_COLORS = [
  "#c2410c",
  "#0f766e",
  "#1d4ed8",
  "#a21caf",
  "#ca8a04",
  "#be123c",
] as const;

export type LngLat = [number, number];
export type PolygonGeometry = { type: "Polygon"; coordinates: LngLat[][] };
export type MultiPolygonGeometry = { type: "MultiPolygon"; coordinates: LngLat[][][] };
export type ZoneArea = PolygonGeometry | MultiPolygonGeometry;

/** One row returned by find_delivery_zone(), cheapest first. */
export type DeliveryMatch = {
  zone_id: string;
  branch_id: string;
  branch_slug: string;
  branch_name_en: string;
  branch_name_ar: string;
  zone_name_en: string;
  zone_name_ar: string;
  fee_fils: number;
  min_order_fils: number;
  eta_minutes: number;
};

const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/** A closed ring with at least 3 different corners. */
function validRing(ring: LngLat[]): boolean {
  if (ring.length < 4) return false;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) return false;
  return new Set(ring.slice(0, -1).map((p) => `${p[0]},${p[1]}`)).size >= 3;
}

const ring = z.array(lngLat).refine((r) => validRing(r as LngLat[]), "invalidArea");

export const zoneAreaSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: z.array(ring).min(1) }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(ring).min(1)).min(1),
  }),
]);

/** Merge the polygons drawn on the map into one area, or null if none. */
export function toZoneArea(polygons: LngLat[][][]): ZoneArea | null {
  const valid = polygons.filter((p) => p.length > 0 && validRing(p[0]!));
  if (valid.length === 0) return null;
  if (valid.length === 1) return { type: "Polygon", coordinates: valid[0]! };
  return { type: "MultiPolygon", coordinates: valid };
}

/** Split a stored area back into polygons for the map editor. */
export function fromZoneArea(area: ZoneArea | null | undefined): LngLat[][][] {
  if (!area) return [];
  return area.type === "Polygon" ? [area.coordinates] : area.coordinates;
}

const whole = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v);
      if (!v || !Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: "invalidNumber" });
        return z.NEVER;
      }
      return n;
    });

/** One named area a zone delivers to, shown to customers as City, then Area. */
export const zoneAreaNameSchema = z.object({
  cityEn: z.string().trim().min(1, "required").max(60),
  cityAr: z.string().trim().min(1, "required").max(60),
  nameEn: z.string().trim().min(1, "required").max(60),
  nameAr: z.string().trim().min(1, "required").max(60),
});

export type ZoneAreaName = z.output<typeof zoneAreaNameSchema>;

/** Same city and area name twice in one zone (case and spaces ignored). */
function hasDuplicateArea(areas: ZoneAreaName[]): boolean {
  const keys = areas.map(
    (a) => `${a.cityEn.trim().toLowerCase()}|${a.nameEn.trim().toLowerCase()}`,
  );
  return new Set(keys).size !== keys.length;
}

export const zoneSchema = z.object({
  branchId: z.string().uuid("required"),
  nameEn: z.string().trim().min(1, "required").max(80),
  nameAr: z.string().trim().min(1, "required").max(80),
  fee: kwdField("invalidPrice"),
  minOrder: kwdField("invalidPrice"),
  etaMinutes: whole(5, 240),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "invalidColor"),
  isActive: z.boolean(),
  area: zoneAreaSchema.nullable().refine((a) => a !== null, "drawArea"),
  areas: z
    .array(zoneAreaNameSchema)
    .max(200)
    .refine((a) => !hasDuplicateArea(a), "duplicateArea"),
});

/** One row of list_delivery_areas(): an area customers can order delivery to. */
export type DeliveryAreaOption = {
  area_id: string;
  city_en: string;
  city_ar: string;
  name_en: string;
  name_ar: string;
  zone_id: string;
  branch_id: string;
  branch_slug: string;
  branch_name_en: string;
  branch_name_ar: string;
  fee_fils: number;
  min_order_fils: number;
  eta_minutes: number;
};

/** Group areas by city for the picker, keeping the database order. */
export function groupAreasByCity<T extends { city_en: string }>(
  areas: T[],
): { city: string; areas: T[] }[] {
  const map = new Map<string, T[]>();
  for (const a of areas) {
    const key = a.city_en;
    const list = map.get(key);
    if (list) list.push(a);
    else map.set(key, [a]);
  }
  return [...map.entries()].map(([city, list]) => ({ city, areas: list }));
}

export type ZoneData = z.output<typeof zoneSchema>;

/** How much more the customer must add to reach the zone minimum (0 if reached). */
export function amountToMinimum(subtotalFils: number, minOrderFils: number): number {
  return Math.max(0, minOrderFils - subtotalFils);
}

/**
 * Ray casting point-in-polygon, for instant feedback while editing.
 * The database (ST_Covers) is the source of truth.
 */
export function areaContains(area: ZoneArea, point: LngLat): boolean {
  const [x, y] = point;
  const inRing = (r: LngLat[]) => {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]!;
      const [xj, yj] = r[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  return fromZoneArea(area).some(
    (poly) => inRing(poly[0]!) && !poly.slice(1).some((hole) => inRing(hole)),
  );
}
