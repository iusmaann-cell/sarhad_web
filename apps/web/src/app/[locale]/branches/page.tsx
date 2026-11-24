import { isOpenAt, WEEK_DAYS } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@sarhad/ui";
import { MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getBranches } from "@/lib/menu";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/branches">): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as Locale,
    namespace: "branchesPage",
  });
  return { title: t("title") };
}

export default async function BranchesPage({ params }: PageProps<"/[locale]/branches">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tc, td, th, branches] = await Promise.all([
    getTranslations("branchesPage"),
    getTranslations("common"),
    getTranslations("days"),
    getTranslations("home"),
    getBranches(),
  ]);
  const now = new Date();

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      {branches.length === 0 ? <p className="text-muted-foreground">{th("noBranches")}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {branches.map((b) => {
          const open = isOpenAt(b.opening_hours, now, b.timezone);
          const address = localized(b, "address", locale);
          return (
            <Card key={b.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{localized(b, "name", locale)}</CardTitle>
                  <Badge variant={open ? "success" : "muted"}>
                    {open ? tc("openNow") : tc("closedNow")}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {b.accepts_delivery ? <Badge variant="secondary">{th("delivery")}</Badge> : null}
                  {b.accepts_pickup ? <Badge variant="secondary">{th("pickup")}</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm">
                {address ? (
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {address}
                  </p>
                ) : null}
                <div>
                  <h3 className="mb-2 font-medium">{t("hours")}</h3>
                  <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-muted-foreground">
                    {WEEK_DAYS.map((d) => {
                      const ranges = b.opening_hours[d] ?? [];
                      return (
                        <div key={d} className="contents">
                          <dt>{td(d)}</dt>
                          <dd dir="ltr" className="text-start tabular-nums">
                            {ranges.length
                              ? ranges.map((r) => `${r.open}–${r.close}`).join(", ")
                              : tc("closed")}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={{ pathname: "/menu", query: { branch: b.slug } }}>
                      {t("viewMenu")}
                    </Link>
                  </Button>
                  {b.phone ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={`tel:${b.phone.replace(/\s/g, "")}`}>
                        <Phone aria-hidden /> {th("call")}
                      </a>
                    </Button>
                  ) : null}
                  {b.whatsapp ? (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`https://wa.me/${b.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle aria-hidden /> {t("whatsapp")}
                      </a>
                    </Button>
                  ) : null}
                  {b.latitude !== null && b.longitude !== null ? (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Navigation aria-hidden /> {t("directions")}
                      </a>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
