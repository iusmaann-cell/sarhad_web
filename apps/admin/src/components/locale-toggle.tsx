import { otherLocale } from "@sarhad/i18n";
import { Button } from "@sarhad/ui";
import { Languages } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { setLocale } from "@/app/actions";

export async function LocaleToggle({ className }: { className?: string }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  const next = otherLocale(locale);
  return (
    <form action={setLocale} className={className}>
      <input type="hidden" name="locale" value={next} />
      <Button type="submit" variant="ghost" size="sm" aria-label={t("language")}>
        <Languages aria-hidden />
        <span lang={next}>{t("switchLanguage")}</span>
      </Button>
    </form>
  );
}
