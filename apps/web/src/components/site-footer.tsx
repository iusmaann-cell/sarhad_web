import { Mail, MessageCircle, Phone } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { CONTACT, telHref, whatsappHref } from "@/lib/contact";

export async function SiteFooter() {
  const [t, tl, tn, ts] = await Promise.all([
    getTranslations("common"),
    getTranslations("legal"),
    getTranslations("nav"),
    getTranslations("start"),
  ]);
  const link = "text-muted-foreground hover:text-foreground";
  return (
    <footer className="border-t border-[#1f1f1f] bg-[#0b0b0b]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="grid content-start gap-3">
          <Image
            src="/brand/logo.png"
            alt={t("brand")}
            width={120}
            height={108}
            className="h-20 w-auto"
          />
          <p className="text-sm text-muted-foreground">{t("followUs")}</p>
        </div>
        <nav className="grid content-start gap-2 text-sm" aria-label={t("brand")}>
          <Link href="/menu" className={link}>
            {tn("menu")}
          </Link>
          <Link href="/branches" className={link}>
            {tn("branches")}
          </Link>
          <Link href="/orders" className={link}>
            {tn("orders")}
          </Link>
          <Link href="/privacy" className={link}>
            {tl("footerPrivacy")}
          </Link>
          <Link href="/terms" className={link}>
            {tl("footerTerms")}
          </Link>
        </nav>
        <div className="grid content-start gap-2 text-sm">
          <p className="font-bold">{t("contactUs")}</p>
          <a href={telHref(CONTACT.phone)} className={`flex items-center gap-2 ${link}`}>
            <Phone className="size-4 text-brand-amber" aria-hidden />
            <span dir="ltr">{CONTACT.phone}</span>
          </a>
          <a
            href={whatsappHref(CONTACT.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 ${link}`}
          >
            <MessageCircle className="size-4 text-brand-amber" aria-hidden />
            {ts("whatsapp")}
          </a>
          <a href={`mailto:${CONTACT.email}`} className={`flex items-center gap-2 ${link}`}>
            <Mail className="size-4 text-brand-amber" aria-hidden />
            <span dir="ltr">{CONTACT.email}</span>
          </a>
        </div>
      </div>
      <div className="border-t border-[#1f1f1f] px-4 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t("brand")} · {t("tagline")}
      </div>
    </footer>
  );
}
