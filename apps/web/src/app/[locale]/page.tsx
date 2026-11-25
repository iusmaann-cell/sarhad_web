import { localized, type Locale } from "@sarhad/i18n";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@sarhad/ui";
import { Bike, MapPin, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MenuItemCard } from "@/components/menu/menu-item-card";
import { Link } from "@/i18n/navigation";
import { getBranches, getBranchMenu } from "@/lib/menu";
import { siteOrigin } from "@/lib/origin";

export default async function HomePage({ params, searchParams }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale;
  const deleted = (await searchParams).deleted === "1";
  setRequestLocale(locale);
  const [t, tc, tm, td, ta, branches] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getTranslations("menu"),
    getTranslations("delivery"),
    getTranslations("account"),
    getBranches(),
  ]);
  // Restaurant details for search engines (schema.org), one entry per branch.
  const origin = await siteOrigin();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": branches.map((b) => ({
      "@type": "Restaurant",
      name: `${tc("brand")} - ${localized(b, "name", locale)}`,
      url: `${origin}${locale === "en" ? "/en" : "/"}`,
      menu: `${origin}${locale === "en" ? "/en" : ""}/menu`,
      telephone: b.phone ?? undefined,
      address: localized(b, "address", locale) || undefined,
      geo:
        b.latitude != null && b.longitude != null
          ? { "@type": "GeoCoordinates", latitude: b.latitude, longitude: b.longitude }
          : undefined,
      acceptsReservations: false,
    })),
  };
  const menu = branches[0] ? await getBranchMenu(branches[0].id) : [];
  const featured = menu
    .flatMap((c) => c.items)
    .filter((i) => i.is_featured)
    .slice(0, 4);

  return (
    <>
      {branches.length ? (
        <script
          type="application/ld+json"
          // JSON with "<" escaped so it cannot close the script tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      ) : null}
      {deleted ? (
        <div role="status" className="border-b bg-secondary px-4 py-3 text-center text-sm">
          {ta("deleted")}
        </div>
      ) : null}
      <section className="bg-gradient-to-b from-secondary to-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:py-28">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t("heroBody")}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/menu">{tm("title")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/branches">{t("ourBranches")}</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/delivery">
                <Bike /> {td("homeCta")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold">{tm("featured")}</h2>
            <Link href="/menu" className="text-sm text-primary hover:underline">
              {tm("title")}
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {featured.map((item) => (
              <MenuItemCard key={item.id} item={item} locale={locale} branchId={branches[0]?.id} />
            ))}
          </div>
        </section>
      ) : null}

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
                  <Link
                    href={{ pathname: "/menu", query: { branch: b.slug } }}
                    className="text-primary hover:underline"
                  >
                    {tc("brand")} · {tm("title")}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
