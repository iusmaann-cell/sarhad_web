import { isOpenAt } from "@sarhad/core";
import type { Locale } from "@sarhad/i18n";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CheckoutForm } from "@/components/checkout/checkout-form";
import { redirect } from "@/i18n/navigation";
import { getDeliveryAreas } from "@/lib/delivery";
import { getBranches } from "@/lib/menu";
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

  const [t, branches, zones, { data: profile }, { data: addresses }] = await Promise.all([
    getTranslations("checkout"),
    getBranches(),
    getDeliveryAreas(),
    supabase.from("profiles").select("full_name, phone").eq("id", auth.user!.id).maybeSingle(),
    supabase
      .from("customer_addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const now = new Date();

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
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
        zones={zones}
        profile={{ name: profile?.full_name ?? "", phone: profile?.phone ?? "" }}
        addresses={addresses ?? []}
      />
    </div>
  );
}
