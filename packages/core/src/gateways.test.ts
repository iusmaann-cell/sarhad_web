import { describe, expect, it, vi } from "vitest";

import { kwd, myFatoorah, splitKuwaitPhone, tap, testGateway } from "./gateways";

const input = {
  paymentId: "11111111-2222-4333-8444-555555555555",
  orderNumber: 1042,
  amountFils: 7250,
  customerName: "Ali Al Salem",
  customerPhone: "+96551234567",
  locale: "ar" as const,
  returnUrl: "https://sarhad.example/api/payments/return?payment=1",
  webhookUrl: "https://sarhad.example/api/payments/webhook?payment=1",
};

function mockFetch(body: unknown, ok = true) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 400 }));
}

describe("helpers", () => {
  it("formats KWD and Kuwaiti phones for gateways", () => {
    expect(kwd(7250)).toBe(7.25);
    expect(kwd(1)).toBe(0.001);
    expect(splitKuwaitPhone("+965 5123 4567")).toEqual({ code: "965", number: "51234567" });
  });
});

describe("MyFatoorah", () => {
  it("creates an invoice link in the sandbox", async () => {
    const f = mockFetch({
      IsSuccess: true,
      Data: { InvoiceId: 300034, InvoiceURL: "https://demo.myfatoorah.com/ie/01" },
    });
    const gw = myFatoorah({ apiKey: "SK_KWT_x", isLive: false }, f);
    const res = await gw.create(input);
    expect(res).toEqual({
      redirectUrl: "https://demo.myfatoorah.com/ie/01",
      providerRef: "300034",
    });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://apitest.myfatoorah.com/v2/SendPayment");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer SK_KWT_x");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      NotificationOption: "LNK",
      InvoiceValue: 7.25,
      DisplayCurrencyIso: "KWD",
      CustomerMobile: "51234567",
      Language: "AR",
      CustomerReference: "1042",
    });
  });

  it("uses the live host in live mode and reads the invoice status", async () => {
    const f = mockFetch({ IsSuccess: true, Data: { InvoiceStatus: "Paid" } });
    const gw = myFatoorah({ apiKey: "k", isLive: true }, f);
    expect((await gw.check("300034")).status).toBe("paid");
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://api.myfatoorah.com/v2/GetPaymentStatus",
    );
    const pending = myFatoorah(
      { apiKey: "k", isLive: true },
      mockFetch({ IsSuccess: true, Data: { InvoiceStatus: "Pending" } }),
    );
    expect((await pending.check("1")).status).toBe("pending");
  });

  it("fails loudly when the gateway refuses", async () => {
    const gw = myFatoorah({ apiKey: "bad", isLive: false }, mockFetch({ IsSuccess: false }, false));
    await expect(gw.create(input)).rejects.toThrow("myfatoorah_create_failed");
  });
});

describe("Tap", () => {
  it("creates a charge and returns its payment page", async () => {
    const f = mockFetch({
      id: "chg_1",
      status: "INITIATED",
      transaction: { url: "https://tap/pay" },
    });
    const gw = tap({ apiKey: "sk_test_x", isLive: false }, f);
    expect(await gw.create(input)).toEqual({
      redirectUrl: "https://tap/pay",
      providerRef: "chg_1",
    });
    const body = JSON.parse(
      (f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body).toMatchObject({
      amount: 7.25,
      currency: "KWD",
      source: { id: "src_all" },
      redirect: { url: input.returnUrl },
      post: { url: input.webhookUrl },
      customer: { first_name: "Ali", last_name: "Al Salem" },
    });
  });

  it("maps charge statuses", async () => {
    const check = async (b: unknown) =>
      (await tap({ apiKey: "k", isLive: false }, mockFetch(b)).check("chg_1")).status;
    expect(await check({ status: "CAPTURED", response: { code: "000" } })).toBe("paid");
    expect(await check({ status: "CANCELLED", response: { code: "302" } })).toBe("cancelled");
    expect(await check({ status: "DECLINED", response: { code: "505" } })).toBe("failed");
    expect(await check({ status: "INITIATED", response: { code: "100" } })).toBe("pending");
  });
});

describe("test gateway", () => {
  it("sends the customer to the local test page and reads the stored outcome", async () => {
    const gw = testGateway("https://sarhad.example", async () => "paid");
    const res = await gw.create({ ...input, locale: "en" });
    expect(res.redirectUrl).toBe(`https://sarhad.example/en/pay/test/${input.paymentId}`);
    expect((await gw.check(res.providerRef)).status).toBe("paid");
  });
});
