import { z } from "zod";

export const WEEK_DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export type TimeRange = { open: string; close: string };
/** Weekly opening hours. A day missing or empty = closed. */
export type OpeningHours = Partial<Record<WeekDay, TimeRange[]>>;

const JS_DAY: WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export const timeRangeSchema = z.object({
  open: z.string().regex(timeRe, "invalidTime"),
  close: z.string().regex(timeRe, "invalidTime"),
});

export const openingHoursSchema = z.partialRecord(
  z.enum(WEEK_DAYS),
  z.array(timeRangeSchema).max(3),
);

function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Local wall-clock day and minute in a time zone (default Kuwait). */
export function localDayMinute(
  date: Date,
  timeZone = "Asia/Kuwait",
): { day: WeekDay; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("weekday").toLowerCase().slice(0, 3) as WeekDay;
  return { day, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

/**
 * Is the branch open at this moment? Ranges that close after midnight
 * (e.g. 11:00-01:00) count for the early hours of the next day too.
 */
export function isOpenAt(hours: OpeningHours, date: Date, timeZone = "Asia/Kuwait"): boolean {
  const { day, minute } = localDayMinute(date, timeZone);
  const today = hours[day] ?? [];
  const prevDay = JS_DAY[(JS_DAY.indexOf(day) + 6) % 7]!;
  const yesterday = hours[prevDay] ?? [];

  for (const r of today) {
    const o = minutes(r.open);
    const c = minutes(r.close);
    if (c > o ? minute >= o && minute < c : minute >= o) return true;
  }
  for (const r of yesterday) {
    const o = minutes(r.open);
    const c = minutes(r.close);
    if (c <= o && minute < c) return true;
  }
  return false;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const optionalText = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v) => (v ? v : null));

const coord = (min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: "invalidNumber" });
        return z.NEVER;
      }
      return n;
    });

export const branchSchema = z
  .object({
    nameEn: z.string().trim().min(1, "required").max(80),
    nameAr: z.string().trim().min(1, "required").max(80),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "invalidSlug"),
    addressEn: optionalText,
    addressAr: optionalText,
    phone: optionalText,
    whatsapp: optionalText,
    latitude: coord(-90, 90),
    longitude: coord(-180, 180),
    isActive: z.boolean(),
    acceptsDelivery: z.boolean(),
    acceptsPickup: z.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
    openingHours: openingHoursSchema,
  })
  .refine((b) => (b.latitude === null) === (b.longitude === null), {
    message: "bothCoordinates",
    path: ["latitude"],
  });

export type BranchData = z.output<typeof branchSchema>;

/** PostGIS value for the branches.location column. */
export function toPointWkt(latitude: number | null, longitude: number | null): string | null {
  return latitude === null || longitude === null
    ? null
    : `SRID=4326;POINT(${longitude} ${latitude})`;
}
