import type { Tables } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@sarhad/ui";
import { MapPin, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type Branch = Pick<
  Tables<"branches">,
  | "id"
  | "slug"
  | "name_en"
  | "name_ar"
  | "address_en"
  | "address_ar"
  | "phone"
  | "accepts_delivery"
  | "accepts_pickup"
>;

async function getBranches(): Promise<Branch[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select(
      "id, slug, name_en, name_ar, address_en, address_ar, phone, accepts_delivery, accepts_pickup",
    )
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tc, branches] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getBranches(),
  ]);

  return (
    <>
      <section className="bg-gradient-to-b from-secondary to-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:py-28">
          <Badge variant="default">{tc("comingSoon")}</Badge>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t("heroBody")}</p>
          <Button size="lg" disabled>
            {t("orderNow")}
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-2xl font-semibold">{t("ourBranches")}</h2>
        {branches.length === 0 ? (
          <p className="text-muted-foreground">{t("noBranches")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <Card key={b.id}>
                <CardHeader>
                  <CardTitle>{localized(b, "name", locale)}</CardTitle>
                  <div className="flex gap-2">
                    {b.accepts_delivery ? <Badge variant="success">{t("delivery")}</Badge> : null}
                    {b.accepts_pickup ? <Badge variant="secondary">{t("pickup")}</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-muted-foreground">
                  {localized(b, "address", locale) ? (
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4 shrink-0" aria-hidden />
                      {localized(b, "address", locale)}
                    </p>
                  ) : null}
                  {b.phone ? (
                    <a
                      href={`tel:${b.phone.replace(/\s/g, "")}`}
                      className="flex items-center gap-2 hover:text-foreground"
                    >
                      <Phone className="size-4 shrink-0" aria-hidden />
                      <span dir="ltr">{b.phone}</span>
                    </a>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
