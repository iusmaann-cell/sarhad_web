import { z } from "zod";

import { parseKwd } from "./menu";

export const PROMO_KINDS = ["percent", "fixed", "free_delivery"] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

/** Codes are stored in capitals: "ramadan10" and "RAMADAN10" are the same code. */
export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** Discount a customer gets, the same rules as promo_quote() on the server. */
export function promoDiscount(
  p: { kind: PromoKind; value: number; max_discount_fils: number | null },
  subtotalFils: number,
  deliveryFeeFils: number,
): number {
  let d =
    p.kind === "percent"
      ? Math.floor((subtotalFils * p.value) / 100)
      : p.kind === "fixed"
        ? Math.min(p.value, subtotalFils)
        : deliveryFeeFils;
  if (p.max_discount_fils !== null) d = Math.min(d, p.max_discount_fils);
  return Math.max(0, d);
}

const optionalKwd = z.string().transform((v, ctx) => {
  if (v.trim() === "") return null;
  const fils = parseKwd(v);
  if (fils === null || fils === 0) {
    ctx.addIssue({ code: "custom", message: "invalidPrice" });
    return z.NEVER;
  }
  return fils;
});

const optionalCount = z.string().transform((v, ctx) => {
  if (v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
    ctx.addIssue({ code: "custom", message: "invalidNumber" });
    return z.NEVER;
  }
  return n;
});

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "invalidDate")
  .transform((v) => (v === "" ? null : v));

/** Back office promo code form. Dates are Kuwait days; amounts are typed in KWD. */
export const promoSchema = z
  .object({
    code: z
      .string()
      .transform(normalizePromoCode)
      .pipe(z.string().regex(/^[A-Z0-9_-]{3,20}$/, "invalidPromoCode")),
    nameEn: z.string().trim().min(1, "required").max(80),
    nameAr: z.string().trim().min(1, "required").max(80),
    kind: z.enum(PROMO_KINDS),
    /** Percent (1-100) or KWD amount, depending on kind. */
    value: z.string(),
    minSubtotal: optionalKwd,
    maxDiscount: optionalKwd,
    branchId: z
      .string()
      .transform((v) => v || null)
      .pipe(z.uuid().nullable()),
    startsOn: optionalDate,
    endsOn: optionalDate,
    maxUses: optionalCount,
    maxUsesPerCustomer: optionalCount,
    firstOrderOnly: z.boolean(),
    isActive: z.boolean(),
  })
  .transform((p, ctx) => {
    let value = 0;
    if (p.kind === "percent") {
      const n = Number(p.value);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "invalidPercent" });
        return z.NEVER;
      }
      value = n;
    } else if (p.kind === "fixed") {
      const fils = parseKwd(p.value);
      if (fils === null || fils === 0) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "invalidPrice" });
        return z.NEVER;
      }
      value = fils;
    }
    if (p.startsOn && p.endsOn && p.endsOn < p.startsOn) {
      ctx.addIssue({ code: "custom", path: ["endsOn"], message: "endBeforeStart" });
      return z.NEVER;
    }
    return {
      code: p.code,
      name_en: p.nameEn,
      name_ar: p.nameAr,
      kind: p.kind,
      value,
      min_subtotal_fils: p.minSubtotal ?? 0,
      max_discount_fils: p.kind === "percent" ? p.maxDiscount : null,
      branch_id: p.branchId,
      // Whole Kuwait days: from the start of startsOn to the end of endsOn.
      starts_at: p.startsOn ? `${p.startsOn}T00:00:00+03:00` : null,
      ends_at: p.endsOn ? kuwaitDayEnd(p.endsOn) : null,
      max_uses: p.maxUses,
      max_uses_per_customer: p.maxUsesPerCustomer,
      first_order_only: p.firstOrderOnly,
      is_active: p.isActive,
    };
  });

export type PromoInput = z.input<typeof promoSchema>;
export type PromoRow = z.output<typeof promoSchema>;

function kuwaitDayEnd(day: string): string {
  const d = new Date(`${day}T00:00:00+03:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** "2026-12-31T21:00:00Z" -> "2027-01-01" in Kuwait time (for date inputs). */
export function kuwaitDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

/** The ends_at stored for a promo is the start of the next day; show the last valid day. */
export function promoLastDay(endsAt: string): string {
  return kuwaitDay(new Date(new Date(endsAt).getTime() - 1).toISOString());
}

// ---------------------------------------------------------------------------
// Payment gateways
// ---------------------------------------------------------------------------

export const PAYMENT_PROVIDER_KINDS = ["myfatoorah", "tap", "test"] as const;
export type PaymentProviderKind = (typeof PAYMENT_PROVIDER_KINDS)[number];

export const paymentProviderSchema = z.object({
  kind: z.enum(PAYMENT_PROVIDER_KINDS),
  nameEn: z.string().trim().min(1, "required").max(60),
  nameAr: z.string().trim().min(1, "required").max(60),
  isActive: z.boolean(),
  isLive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  /** Blank keeps the saved key. */
  apiKey: z.string().trim().max(2000),
});
