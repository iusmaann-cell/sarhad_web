import { isOpenAt } from "@sarhad/core";
import type { Locale } from "@sarhad/i18n";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CheckoutForm } from "@/components/checkout/checkout-form";
import { redirect } from "@/i18n/navigation";
import { getBranches } from "@/lib/menu";
import { allowTestGateway } from "@/lib/payments/gateways";
import { hasAdminKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/checkout">): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as Locale,
    namespace: "checkout",
  });
  return { title: t("title") };
}

export default async function CheckoutPage({ params }: PageProps<"/[locale]/checkout">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect({ href: "/sign-in?next=/checkout", locale });

  const [t, branches, { data: profile }, { data: addresses }, { data: providers }] =
    await Promise.all([
      getTranslations("checkout"),
      getBranches(),
      supabase.from("profiles").select("full_name, phone").eq("id", auth.user!.id).maybeSingle(),
      supabase
        .from("customer_addresses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("payment_providers")
        .select("id, kind, name_en, name_ar")
        .eq("is_active", true)
        .order("sort_order"),
    ]);
  // The test gateway is offered only where it is allowed (never in production).
  const online = hasAdminKey()
    ? (providers ?? []).filter((p) => p.kind !== "test" || allowTestGateway())
    : [];
  const now = new Date();

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      <CheckoutForm
        branches={branches.map((b) => ({
          id: b.id,
          slug: b.slug,
          name_en: b.name_en,
          name_ar: b.name_ar,
          accepts_delivery: b.accepts_delivery,
          accepts_pickup: b.accepts_pickup,
          open: b.accepting_orders && isOpenAt(b.opening_hours, now, b.timezone),
        }))}
        profile={{ name: profile?.full_name ?? "", phone: profile?.phone ?? "" }}
        addresses={addresses ?? []}
        providers={online.map(({ id, name_en, name_ar }) => ({ id, name_en, name_ar }))}
      />
    </div>
  );
}
