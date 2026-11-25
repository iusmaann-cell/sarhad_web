import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const [t, tl] = await Promise.all([getTranslations("common"), getTranslations("legal")]);
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {new Date().getFullYear()} {t("brand")}
        </span>
        <nav className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            {tl("footerPrivacy")}
          </Link>
          <Link href="/terms" className="hover:text-foreground hover:underline">
            {tl("footerTerms")}
          </Link>
        </nav>
        <span>{t("tagline")}</span>
      </div>
    </footer>
  );
}
