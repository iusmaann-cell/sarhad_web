import { localized, type Locale } from "@sarhad/i18n";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sarhad/ui";
import { Banknote, CreditCard, Plus } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import { ProviderForm } from "./provider-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payments");
  return { title: t("title") };
}

/** Settings > Payments: cash is always on; admins connect online gateways here. */
export default async function SettingsPage() {
  const staff = await requireStaff();
  if (!staff.isAdmin) redirect("/");
  const [t, locale] = await Promise.all([
    getTranslations("payments"),
    getLocale() as Promise<Locale>,
  ]);
  const supabase = await createClient();
  const { data: providers } = await supabase
    .from("payment_providers")
    .select("*")
    .order("sort_order")
    .order("created_at");

  return (
    <div className="grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <CardDescription>{t("intro")}</CardDescription>
      </div>

      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          <Banknote className="size-6 text-primary" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">{t("cash")}</p>
            <p className="text-sm text-muted-foreground">{t("cashHint")}</p>
          </div>
          <Badge variant="success">{t("active")}</Badge>
        </CardContent>
      </Card>

      {(providers ?? []).map((p) => (
        <Card key={p.id} data-testid="provider">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <CreditCard className="size-5 text-primary" aria-hidden />
              {localized(p, "name", locale)}
              <span className="text-sm font-normal text-muted-foreground">
                · {t(`kinds.${p.kind}`)}
              </span>
              <Badge variant={p.is_active ? "success" : "muted"} className="ms-auto">
                {p.is_active ? t("active") : t("inactive")}
              </Badge>
              {p.kind !== "test" ? (
                <Badge variant={p.is_live ? "default" : "secondary"}>
                  {p.is_live ? t("live") : t("sandbox")}
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProviderForm
              id={p.id}
              keyHint={p.key_hint}
              initial={{
                kind: p.kind,
                nameEn: p.name_en,
                nameAr: p.name_ar,
                isActive: p.is_active,
                isLive: p.is_live,
                sortOrder: String(p.sort_order),
              }}
            />
          </CardContent>
        </Card>
      ))}

      {!providers?.length ? <p className="text-muted-foreground">{t("none")}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-5" aria-hidden /> {t("add")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProviderForm id={null} key={providers?.length ?? 0} />
        </CardContent>
      </Card>

      <Alert>{t("serverNote")}</Alert>
    </div>
  );
}
