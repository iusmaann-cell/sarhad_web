import type { Locale } from "@sarhad/i18n";
import { getFormatter, getTranslations } from "next-intl/server";

// The date the policy text in the messages files was last changed.
export const LEGAL_UPDATED = new Date("2026-11-25T00:00:00+03:00");

export async function LegalPage({ locale, doc }: { locale: Locale; doc: "privacy" | "terms" }) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "legal" }),
    getFormatter({ locale }),
  ]);
  const sections = t.raw(doc) as [string, string][];
  return (
    <article className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <header className="grid gap-1">
        <h1 className="text-3xl font-bold">
          {t(doc === "privacy" ? "privacyTitle" : "termsTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("updated", { date: format.dateTime(LEGAL_UPDATED, { dateStyle: "long" }) })}
        </p>
      </header>
      {sections.map(([title, body]) => (
        <section key={title} className="grid gap-2">
          <h2 className="text-xl font-semibold">{title}</h2>
          {body.split("\n").map((p, i) => (
            <p key={i} className="leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
