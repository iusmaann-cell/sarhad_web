"use client";

import { otherLocale } from "@sarhad/i18n";
import { Button } from "@sarhad/ui";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const next = otherLocale(locale);

  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={pathname} locale={next} hrefLang={next} aria-label={t("language")}>
        <Languages aria-hidden />
        <span lang={next} className="hidden sm:inline">
          {t("switchLanguage")}
        </span>
      </Link>
    </Button>
  );
}
