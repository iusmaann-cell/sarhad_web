import { formatPrice, menuImageUrl, type MenuItem } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Badge, Card, cn } from "@sarhad/ui";
import { UtensilsCrossed } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { imageBase } from "@/lib/menu";

import { AddToCart } from "./add-to-cart";

export async function MenuItemCard({
  item,
  locale,
  branchId,
}: {
  item: MenuItem;
  locale: Locale;
  /** When set, shows the "Add" button for this branch. */
  branchId?: string;
}) {
  const t = await getTranslations("menu");
  const img = menuImageUrl(imageBase(), item.image_path);
  const name = localized(item, "name", locale);
  const description = localized(item, "description", locale);

  return (
    <Card className={cn("flex gap-4 overflow-hidden p-3", !item.is_available && "opacity-60")}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={name}
          loading="lazy"
          className="size-24 shrink-0 rounded-lg object-cover sm:size-28"
        />
      ) : (
        <div
          className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground sm:size-28"
          aria-hidden
        >
          <UtensilsCrossed className="size-8 opacity-50" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{name}</h3>
          {item.is_featured ? <Badge>{t("featured")}</Badge> : null}
          {!item.is_available ? <Badge variant="muted">{t("soldOut")}</Badge> : null}
        </div>
        {description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {item.modifier_groups.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-primary">{t("options")}</summary>
            <div className="mt-2 grid gap-2">
              {item.modifier_groups.map((g) => (
                <div key={g.id}>
                  <p className="font-medium">
                    {localized(g, "name", locale)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {g.min_select > 0 ? `${t("required")} · ` : ""}
                      {g.min_select === g.max_select
                        ? t("choose", { count: g.max_select })
                        : t("chooseUpTo", { count: g.max_select })}
                    </span>
                  </p>
                  <ul className="text-muted-foreground">
                    {g.options.map((o) => (
                      <li key={o.id} className="flex justify-between gap-2">
                        <span>{localized(o, "name", locale)}</span>
                        {o.price_delta_fils > 0 ? (
                          <span className="tabular-nums">
                            +{formatPrice(o.price_delta_fils, locale)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="font-semibold tabular-nums text-primary">
            {formatPrice(item.price_fils, locale)}
          </span>
          <span className="flex items-center gap-3">
            {item.calories ? (
              <span className="text-xs text-muted-foreground">
                {t("calories", { count: item.calories })}
              </span>
            ) : null}
            {branchId ? <AddToCart item={item} branchId={branchId} /> : null}
          </span>
        </div>
      </div>
    </Card>
  );
}
