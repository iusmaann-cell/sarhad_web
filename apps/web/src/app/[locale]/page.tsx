import { localized, type Locale } from "@sarhad/i18n";
import { ArrowRight, Bike, CreditCard, MapPin, Phone, Radar } from "lucide-react";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MenuItemCard } from "@/components/menu/menu-item-card";
import { StartOrderButton } from "@/components/order-start/order-chip";
import { Link } from "@/i18n/navigation";
import { getBranches, getBranchMenu } from "@/lib/menu";
import { getOrderStart } from "@/lib/order-start";
import { orderStartBranchId } from "@/lib/order-start-shared";
import { siteOrigin } from "@/lib/origin";

export default async function HomePage({ params, searchParams }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale;
  const deleted = (await searchParams).deleted === "1";
  setRequestLocale(locale);
  const [t, tc, ta, branches, { start }] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getTranslations("account"),
    getBranches(),
    getOrderStart(),
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
  const menuBranchId = orderStartBranchId(start) ?? branches[0]?.id;
  const menu = menuBranchId ? await getBranchMenu(menuBranchId) : [];
  const all = menu.flatMap((c) => c.items).filter((i) => i.is_available);
  const featured = (all.some((i) => i.is_featured) ? all.filter((i) => i.is_featured) : all).slice(
    0,
    4,
  );
  const perks = [
    { Icon: Bike, label: t("perkType") },
    { Icon: CreditCard, label: t("perkPay") },
    { Icon: Radar, label: t("perkTrack") },
  ];
  const steps = [
    { title: t("step1"), body: t("step1Body") },
    { title: t("step2"), body: t("step2Body") },
    { title: t("step3"), body: t("step3Body") },
  ];

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

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-40 -top-40 size-[36rem] rounded-full opacity-25 blur-3xl"
          style={{ backgroundImage: "var(--brand-gradient)" }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div className="grid justify-items-start gap-6">
            <p className="rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-bold text-brand-amber">
              {t("heroKicker")}
            </p>
            <h1 className="font-display text-5xl leading-[1.1] sm:text-6xl lg:text-7xl">
              {t("heroTitleScript")}
              <br />
              <span className="text-gradient">{t("heroTitleRest")}</span>
            </h1>
            <p className="max-w-xl text-lg text-[#c8c8c8]">{t("heroBody")}</p>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <StartOrderButton label={t("startOrder")} className="flex-1 sm:flex-none" />
              <Link
                href="/branches"
                className="inline-flex h-14 flex-1 items-center justify-center rounded-full border-2 border-input px-8 font-bold hover:border-brand-amber sm:flex-none"
              >
                {t("findBranch")}
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {perks.map(({ Icon, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <Icon className="size-4 text-brand-amber" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div
              aria-hidden
              className="absolute inset-[8%] rounded-full opacity-40 blur-2xl"
              style={{ backgroundImage: "var(--brand-gradient)" }}
            />
            <Image
              src="/brand/logo.png"
              alt={t("mascotAlt")}
              width={480}
              height={433}
              priority
              className="relative h-auto w-full"
            />
          </div>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-3xl font-extrabold">{t("popular")}</h2>
            <Link
              href="/menu"
              className="flex items-center gap-1 font-bold text-brand-amber hover:underline"
            >
              {t("seeMenu")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                locale={locale}
                branchId={start ? menuBranchId : undefined}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-3xl font-extrabold">{t("howItWorks")}</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="grid gap-2 rounded-[1.25rem] border border-border bg-card p-6"
            >
              <span
                className="flex size-11 items-center justify-center rounded-full text-lg font-extrabold text-black"
                style={{ backgroundImage: "var(--brand-gradient)" }}
                aria-hidden
              >
                {i + 1}
              </span>
              <h3 className="text-xl font-extrabold">{s.title}</h3>
              <p className="text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-3xl font-extrabold">{t("ourBranches")}</h2>
        {branches.length === 0 ? (
          <p className="text-muted-foreground">{t("noBranches")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <article
                key={b.id}
                className="grid content-start gap-3 rounded-[1.25rem] border border-border bg-card p-5"
              >
                <h3 className="text-lg font-extrabold">{localized(b, "name", locale)}</h3>
                <div className="flex gap-2 text-xs font-bold">
                  {b.accepts_delivery ? (
                    <span className="rounded-full bg-success/15 px-2.5 py-1 text-success">
                      {t("delivery")}
                    </span>
                  ) : null}
                  {b.accepts_pickup ? (
                    <span className="rounded-full bg-secondary px-2.5 py-1">{t("pickup")}</span>
                  ) : null}
                </div>
                {localized(b, "address", locale) ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0 text-brand-amber" aria-hidden />
                    {localized(b, "address", locale)}
                  </p>
                ) : null}
                {b.phone ? (
                  <a
                    href={`tel:${b.phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="size-4 shrink-0 text-brand-amber" aria-hidden />
                    <span dir="ltr">{b.phone}</span>
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
