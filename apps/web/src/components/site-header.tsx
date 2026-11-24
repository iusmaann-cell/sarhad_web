import { Button } from "@sarhad/ui";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";

import { LocaleSwitcher } from "./locale-switcher";
import { SignOutButton } from "./sign-out-button";

export async function SiteHeader() {
  const [t, tc, user] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
    getUser(),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-xl font-bold text-primary">
          {tc("brand")}
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/menu"
            className="hidden rounded-md px-3 py-2 text-sm hover:bg-muted sm:inline-block"
          >
            {t("menu")}
          </Link>
          <Link
            href="/branches"
            className="hidden rounded-md px-3 py-2 text-sm hover:bg-muted sm:inline-block"
          >
            {t("branches")}
          </Link>
          <Link
            href="/delivery"
            className="hidden rounded-md px-3 py-2 text-sm hover:bg-muted md:inline-block"
          >
            {t("delivery")}
          </Link>
          <LocaleSwitcher />
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/account">{t("account")}</Link>
              </Button>
              <SignOutButton label={t("signOut")} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/sign-in">{t("signIn")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">{t("signUp")}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
