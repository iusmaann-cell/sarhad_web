import { localized, type Locale } from "@sarhad/i18n";
import { Badge } from "@sarhad/ui";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MenuItemCard } from "@/components/menu/menu-item-card";
import { Link } from "@/i18n/navigation";
import { getBranches, getBranchMenu } from "@/lib/menu";

export async function generateMetadata({ params }: PageProps<"/[locale]/menu">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "menu" });
  return { title: t("title") };
}

export default async function MenuPage({ params, searchParams }: PageProps<"/[locale]/menu">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const sp = await searchParams;
  const [t, tc, branches] = await Promise.all([
    getTranslations("menu"),
    getTranslations("common"),
    getBranches(),
  ]);
  const branch = branches.find((b) => b.slug === sp.branch) ?? branches[0];
  const menu = branch ? await getBranchMenu(branch.id) : [];

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Badge variant="secondary">{t("orderingSoon")}</Badge>
      </div>

      {branches.length > 1 ? (
        <nav aria-label={tc("selectBranch")} className="flex flex-wrap gap-2">
          {branches.map((b) => (
            <Link
              key={b.id}
              href={{ pathname: "/menu", query: { branch: b.slug } }}
              aria-current={b.id === branch?.id ? "page" : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm ${b.id === branch?.id ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            >
              {localized(b, "name", locale)}
            </Link>
          ))}
        </nav>
      ) : null}

      {menu.length === 0 ? (
        <p className="text-muted-foreground">{t("emptyMenu")}</p>
      ) : (
        <>
          <nav className="sticky top-16 z-30 -mx-4 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur">
            <ul className="flex gap-2 whitespace-nowrap">
              {menu.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#cat-${c.id}`}
                    className="inline-block rounded-full px-3 py-1 text-sm hover:bg-muted"
                  >
                    {localized(c, "name", locale)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {menu.map((c) => (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32">
              <h2 className="mb-1 text-2xl font-semibold">{localized(c, "name", locale)}</h2>
              {localized(c, "description", locale) ? (
                <p className="mb-3 text-muted-foreground">{localized(c, "description", locale)}</p>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                {c.items.map((item) => (
                  <MenuItemCard key={item.id} item={item} locale={locale} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
