import type { PaymentProviderKind } from "./promotions";

/** What every gateway needs to start a payment. */
export type CreatePaymentInput = {
  paymentId: string;
  orderNumber: number;
  amountFils: number;
  customerName: string;
  customerPhone: string;
  locale: "ar" | "en";
  /** Where the customer comes back to after paying (or giving up). */
  returnUrl: string;
  /** Where the gateway may POST the result (server to server). */
  webhookUrl: string;
};

export type CreatePaymentResult = { redirectUrl: string; providerRef: string };

export type PaymentCheck = {
  status: "paid" | "failed" | "pending" | "cancelled";
  providerRef?: string;
  raw: Record<string, unknown>;
};

export type GatewayConfig = { apiKey: string; isLive: boolean };

export interface Gateway {
  create(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Asks the gateway itself for the result. Never trust the return URL's query string. */
  check(providerRef: string): Promise<PaymentCheck>;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

/** KWD amount with 3 decimals, as gateways expect it (2250 fils -> 2.25). */
export function kwd(fils: number): number {
  return Math.round(fils) / 1000;
}

/** "+96551234567" -> { code: "965", number: "51234567" }. */
export function splitKuwaitPhone(phone: string): { code: string; number: string } {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("965") && digits.length === 11) {
    return { code: "965", number: digits.slice(3) };
  }
  return { code: "965", number: digits.slice(-8) };
}

type Fetch = typeof fetch;

async function json(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { body: text.slice(0, 500) };
  }
}

// ---------------------------------------------------------------------------
// MyFatoorah (KNET, Visa/Mastercard, Apple Pay). https://docs.myfatoorah.com
// ---------------------------------------------------------------------------

export function myFatoorah(config: GatewayConfig, f: Fetch = fetch): Gateway {
  const base = config.isLive ? "https://api.myfatoorah.com" : "https://apitest.myfatoorah.com";
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  return {
    async create(input) {
      const phone = splitKuwaitPhone(input.customerPhone);
      const res = await f(`${base}/v2/SendPayment`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          NotificationOption: "LNK",
          CustomerName: input.customerName.slice(0, 100),
          MobileCountryCode: `+${phone.code}`,
          CustomerMobile: phone.number,
          InvoiceValue: kwd(input.amountFils),
          DisplayCurrencyIso: "KWD",
          CallBackUrl: input.returnUrl,
          ErrorUrl: input.returnUrl,
          Language: input.locale === "ar" ? "AR" : "EN",
          CustomerReference: String(input.orderNumber),
          UserDefinedField: input.paymentId,
        }),
      });
      const body = await json(res);
      const data = body.Data as { InvoiceId?: number; InvoiceURL?: string } | undefined;
      if (!res.ok || body.IsSuccess !== true || !data?.InvoiceURL || !data.InvoiceId) {
        throw new GatewayError("myfatoorah_create_failed", body);
      }
      return { redirectUrl: data.InvoiceURL, providerRef: String(data.InvoiceId) };
    },

    async check(invoiceId) {
      const res = await f(`${base}/v2/GetPaymentStatus`, {
        method: "POST",
        headers,
        body: JSON.stringify({ Key: invoiceId, KeyType: "InvoiceId" }),
      });
      const body = await json(res);
      const data = body.Data as { InvoiceStatus?: string } | undefined;
      if (!res.ok || body.IsSuccess !== true || !data) {
        throw new GatewayError("myfatoorah_status_failed", body);
      }
      const status =
        data.InvoiceStatus === "Paid"
          ? "paid"
          : data.InvoiceStatus === "Canceled"
            ? "cancelled"
            : "pending";
      return { status, raw: { myfatoorah: data } };
    },
  };
}

// ---------------------------------------------------------------------------
// Tap Payments (KNET, cards, Apple Pay). https://developers.tap.company
// ---------------------------------------------------------------------------

const TAP_FAILED = new Set(["FAILED", "DECLINED", "RESTRICTED", "VOID", "TIMEDOUT", "UNKNOWN"]);

export function tap(config: GatewayConfig, f: Fetch = fetch): Gateway {
  // Tap uses one host; the key (sk_test_ / sk_live_) decides test or live.
  const base = "https://api.tap.company/v2";
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  return {
    async create(input) {
      const phone = splitKuwaitPhone(input.customerPhone);
      const [first, ...rest] = input.customerName.trim().split(/\s+/);
      const res = await f(`${base}/charges`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: kwd(input.amountFils),
          currency: "KWD",
          threeDSecure: true,
          customer_initiated: true,
          description: `Order #${input.orderNumber}`,
          reference: { transaction: input.paymentId, order: String(input.orderNumber) },
          metadata: { payment_id: input.paymentId },
          customer: {
            first_name: first || "Customer",
            last_name: rest.join(" ") || undefined,
            phone: { country_code: phone.code, number: phone.number },
          },
          source: { id: "src_all" },
          redirect: { url: input.returnUrl },
          post: { url: input.webhookUrl },
        }),
      });
      const body = await json(res);
      const url = (body.transaction as { url?: string } | undefined)?.url;
      if (!res.ok || typeof body.id !== "string" || !url) {
        throw new GatewayError("tap_create_failed", body);
      }
      return { redirectUrl: url, providerRef: body.id };
    },

    async check(chargeId) {
      const res = await f(`${base}/charges/${encodeURIComponent(chargeId)}`, { headers });
      const body = await json(res);
      if (!res.ok || typeof body.status !== "string") {
        throw new GatewayError("tap_status_failed", body);
      }
      const code = (body.response as { code?: string } | undefined)?.code;
      const s = body.status.toUpperCase();
      const status =
        s === "CAPTURED" || code === "000"
          ? "paid"
          : s === "CANCELLED" || code === "302"
            ? "cancelled"
            : TAP_FAILED.has(s)
              ? "failed"
              : "pending";
      return {
        status,
        raw: { tap: { id: body.id, status: body.status, response: body.response } },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Built-in test gateway: a page on this site with "Pay" and "Decline"
// buttons, to try the whole flow without a merchant account. Its result is
// stored on the payment row; see allowTestGateway().
// ---------------------------------------------------------------------------

export function testGateway(
  origin: string,
  readOutcome: (paymentId: string) => Promise<string | null>,
): Gateway {
  return {
    async create(input) {
      return {
        redirectUrl: `${origin}/${input.locale === "en" ? "en/" : ""}pay/test/${input.paymentId}`,
        providerRef: `test_${input.paymentId}`,
      };
    },
    async check(ref) {
      const outcome = await readOutcome(ref.replace(/^test_/, ""));
      const status = outcome === "paid" ? "paid" : outcome === "declined" ? "failed" : "pending";
      return { status, raw: { test: { outcome } } };
    },
  };
}

export function isProviderKind(kind: string): kind is PaymentProviderKind {
  return kind === "myfatoorah" || kind === "tap" || kind === "test";
}
