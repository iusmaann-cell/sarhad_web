import { Button } from "@sarhad/ui";
import { UserRound } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth";

import { CartButton } from "./cart/cart-button";
import { LocaleSwitcher } from "./locale-switcher";
import { OrderChip } from "./order-start/order-chip";
import { SignOutButton } from "./sign-out-button";

export async function SiteHeader() {
  const [t, tc, user] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
    getUser(),
  ]);
  const navLink =
    "hidden rounded-full px-3 py-2 text-sm font-semibold text-foreground/85 hover:bg-secondary hover:text-foreground lg:inline-block";

  return (
    <header className="sticky top-0 z-40 border-b border-[#1f1f1f] bg-black/90 backdrop-blur">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center gap-2 px-4 sm:gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={tc("brand")}>
          <Image
            src="/brand/logo.png"
            alt=""
            width={64}
            height={58}
            className="h-12 w-auto"
            priority
          />
        </Link>
        <nav className="flex items-center gap-1" aria-label={tc("brand")}>
          <Link href="/menu" className={navLink}>
            {t("menu")}
          </Link>
          <Link href="/branches" className={navLink}>
            {t("branches")}
          </Link>
          {user ? (
            <Link href="/orders" className={navLink}>
              {t("orders")}
            </Link>
          ) : null}
        </nav>
        <OrderChip className="ms-auto max-w-[11rem] sm:max-w-[16rem]" />
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <CartButton />
          {user ? (
            <>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="rounded-full lg:hidden"
                aria-label={t("account")}
              >
                <Link href="/account">
                  <UserRound className="size-5" />
                </Link>
              </Button>
              <span className="hidden lg:inline-flex">
                <SignOutButton label={t("signOut")} />
              </span>
            </>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="rounded-full sm:hidden"
                aria-label={t("signIn")}
              >
                <Link href="/sign-in">
                  <UserRound className="size-5" />
                </Link>
              </Button>
              <Link
                href="/sign-in"
                className="hidden h-10 items-center rounded-full border border-input px-4 text-sm font-bold hover:border-brand-amber sm:inline-flex"
              >
                {t("signIn")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
