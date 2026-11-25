import type { Locale } from "@sarhad/i18n";
import { Alert, Button, Card, CardContent } from "@sarhad/ui";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const metadata: Metadata = { robots: { index: false } };

/** Where a payment started in the mobile app lands: points the customer back to the app. */
export default async function PaymentResultPage({
  params,
  searchParams,
}: PageProps<"/[locale]/pay/result">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("orders");
  const paid = sp.payment === "paid";
  const order = typeof sp.order === "string" && /^[0-9a-f-]{36}$/i.test(sp.order) ? sp.order : null;

  return (
    <div className="mx-auto grid max-w-md gap-6 px-4 py-12">
      <Card>
        <CardContent className="grid gap-4 pt-6">
          <Alert variant={paid ? "success" : "destructive"} data-testid="payment-result">
            {paid ? t("paymentDone") : t("paymentFailed")}
          </Alert>
          <p className="text-sm text-muted-foreground">{t("backToAppHint")}</p>
          <Button asChild size="lg">
            <a href={order ? `sarhad://orders/${order}` : "sarhad://orders"}>{t("backToApp")}</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
