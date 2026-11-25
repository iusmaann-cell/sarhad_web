import { localized, type Locale } from "@sarhad/i18n";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MenuItemCard } from "@/components/menu/menu-item-card";
import { OrderStartCard, StartOrderButton } from "@/components/order-start/order-chip";
import { getBranches, getBranchMenu } from "@/lib/menu";
import { getOrderStart } from "@/lib/order-start";
import { orderStartBranchId } from "@/lib/order-start-shared";

export async function generateMetadata({ params }: PageProps<"/[locale]/menu">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "menu" });
  return { title: t("title") };
}

export default async function MenuPage({ params, searchParams }: PageProps<"/[locale]/menu">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const sp = await searchParams;
  const [t, ts, th, branches, { start }] = await Promise.all([
    getTranslations("menu"),
    getTranslations("start"),
    getTranslations("home"),
    getBranches(),
    getOrderStart(),
  ]);
  // The visitor's delivery area or pickup branch decides the menu. Before they
  // choose, show a branch's menu to browse (from a branch page link, or the first).
  const chosenId = orderStartBranchId(start);
  const branch =
    branches.find((b) => b.id === chosenId) ??
    branches.find((b) => b.slug === sp.branch) ??
    branches[0];
  const menu = branch ? await getBranchMenu(branch.id) : [];
  const canOrder = Boolean(chosenId && branch?.id === chosenId);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
      <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,26rem)] md:items-end">
        <div>
          <h1 className="font-display text-5xl leading-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canOrder ? (
          <OrderStartCard />
        ) : (
          <div className="grid gap-3 rounded-[1.25rem] border border-primary/40 bg-primary/10 p-4">
            <p className="font-bold">{ts("chooseHow")}</p>
            <StartOrderButton label={th("startOrder")} className="h-12" />
          </div>
        )}
      </div>

      {menu.length === 0 ? (
        <p className="text-muted-foreground">{t("emptyMenu")}</p>
      ) : (
        <>
          <nav
            aria-label={t("title")}
            className="sticky top-[4.5rem] z-30 -mx-4 overflow-x-auto border-b border-[#1f1f1f] bg-black/95 px-4 py-3 backdrop-blur"
          >
            <ul className="flex gap-2 whitespace-nowrap">
              {menu.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#cat-${c.id}`}
                    className="inline-flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-semibold hover:border-brand-amber"
                  >
                    {localized(c, "name", locale)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {menu.map((c) => (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-40">
              <h2 className="mb-1 text-2xl font-extrabold">{localized(c, "name", locale)}</h2>
              {localized(c, "description", locale) ? (
                <p className="mb-3 text-muted-foreground">{localized(c, "description", locale)}</p>
              ) : null}
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {c.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    locale={locale}
                    branchId={canOrder ? branch?.id : undefined}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
