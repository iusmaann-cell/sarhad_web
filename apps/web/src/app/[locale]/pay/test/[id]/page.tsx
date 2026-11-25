import { formatPrice } from "@sarhad/core";
import type { Locale } from "@sarhad/i18n";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from "@sarhad/ui";
import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { allowTestGateway } from "@/lib/payments/gateways";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";

export const metadata: Metadata = { robots: { index: false } };

/** The built-in test gateway: lets the whole online payment flow be tried without a bank. */
export default async function TestPaymentPage({ params }: PageProps<"/[locale]/pay/test/[id]">) {
  const { locale: l, id } = await params;
  const locale = l as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("payTest");

  const payment =
    allowTestGateway() && hasAdminKey() && /^[0-9a-f-]{36}$/i.test(id)
      ? (
          await createAdminClient()
            .from("payments")
            .select("id, amount_fils, status, provider_kind")
            .eq("id", id)
            .maybeSingle()
        ).data
      : null;
  const usable = payment?.provider_kind === "test" && payment.status === "initiated";

  return (
    <div className="mx-auto grid max-w-md gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-5 text-primary" aria-hidden /> {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Alert>{t("body")}</Alert>
          {usable ? (
            <>
              <p className="text-center text-3xl font-bold tabular-nums">
                {formatPrice(payment.amount_fils, locale)}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <form method="post" action="/api/payments/test">
                  <input type="hidden" name="payment" value={payment.id} />
                  <input type="hidden" name="outcome" value="declined" />
                  <Button type="submit" variant="outline" className="w-full">
                    {t("decline")}
                  </Button>
                </form>
                <form method="post" action="/api/payments/test">
                  <input type="hidden" name="payment" value={payment.id} />
                  <input type="hidden" name="outcome" value="paid" />
                  <Button type="submit" className="w-full" data-testid="test-pay">
                    {t("approve")}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">{t("notAvailable")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
