export * from "./database.types";
export * from "./roles";
export * from "./validation";

/** Kuwaiti dinar uses 3 decimal places (1 KWD = 1000 fils). */
export const CURRENCY = "KWD";
export const CURRENCY_DECIMALS = 3;

export function formatPrice(amountFils: number, locale: "ar" | "en"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-KW" : "en-KW", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: CURRENCY_DECIMALS,
  }).format(amountFils / 1000);
}

export * from "./branches";
export * from "./menu";
