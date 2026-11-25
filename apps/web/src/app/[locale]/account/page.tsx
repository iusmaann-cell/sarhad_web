import type { Locale } from "@sarhad/i18n";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@sarhad/ui";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DeleteAccount } from "@/components/account/delete-account";
import { SignOutButton } from "@/components/sign-out-button";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account">): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as Locale,
    namespace: "account",
  });
  return { title: t("title") };
}

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  const ta = await getTranslations("auth");
  const tn = await getTranslations("nav");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect({ href: "/sign-in?next=/account", locale });
  const user = auth.user!;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, preferred_locale")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">{ta("fullName")}</dt>
            <dd>{profile?.full_name ?? "-"}</dd>
            <dt className="text-muted-foreground">{ta("email")}</dt>
            <dd dir="ltr" className="text-start">
              {user.email}
            </dd>
            <dt className="text-muted-foreground">{ta("phone")}</dt>
            <dd dir="ltr" className="text-start">
              {profile?.phone ?? "-"}
            </dd>
            <dt className="text-muted-foreground">{t("preferredLanguage")}</dt>
            <dd>{profile?.preferred_locale === "en" ? "English" : "العربية"}</dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("orders")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/orders">{tn("orders")}</Link>
          </Button>
          <SignOutButton label={tn("signOut")} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("privacy")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild variant="link" className="px-0">
            <Link href="/privacy">{t("privacyPolicy")}</Link>
          </Button>
          <DeleteAccount />
        </CardContent>
      </Card>
    </div>
  );
}
