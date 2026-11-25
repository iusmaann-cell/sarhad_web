import { formatPrice, menuImageUrl, type MenuItem } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { cn } from "@sarhad/ui";
import Image from "next/image";
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
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-[1.25rem] border border-border bg-card transition-colors hover:border-[#3a3a3a]",
        !item.is_available && "opacity-60",
      )}
    >
      <div className="relative aspect-[4/3] bg-[#1b1b1b]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={name} loading="lazy" className="size-full object-cover" />
        ) : (
          // Placeholder until the owner's food photos are uploaded in the back office.
          <div className="flex size-full items-center justify-center" aria-hidden>
            <Image
              src="/brand/logo.png"
              alt=""
              width={120}
              height={108}
              className="h-1/2 w-auto opacity-20 grayscale"
            />
          </div>
        )}
        <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
          {item.is_featured ? (
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-black">
              {t("featured")}
            </span>
          ) : null}
          {!item.is_available ? (
            <span className="rounded-full bg-black/80 px-2.5 py-1 text-xs font-bold text-muted-foreground">
              {t("soldOut")}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="text-lg font-extrabold leading-snug">{name}</h3>
        {description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {item.calories ? (
          <p className="text-xs text-muted-foreground">{t("calories", { count: item.calories })}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-lg font-extrabold tabular-nums">
            {formatPrice(item.price_fils, locale)}
          </span>
          {branchId ? <AddToCart item={item} branchId={branchId} /> : null}
        </div>
      </div>
    </article>
  );
}
