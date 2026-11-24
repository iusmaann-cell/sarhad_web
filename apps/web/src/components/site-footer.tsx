import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("common");
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span>
          © {new Date().getFullYear()} {t("brand")}
        </span>
        <span>{t("tagline")}</span>
      </div>
    </footer>
  );
}
