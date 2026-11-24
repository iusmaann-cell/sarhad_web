import { canManageBranch, ZONE_COLORS } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/staff";

import { editorContext } from "../page-data";
import { ZoneForm } from "../zone-form";

export default async function NewZonePage({ searchParams }: PageProps<"/zones/new">) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const branchId = typeof sp.branch === "string" ? sp.branch : "";
  if (!branchId || !canManageBranch(staff.roles, branchId)) redirect("/zones");

  const [t, locale] = await Promise.all([getTranslations("admin"), getLocale() as Promise<Locale>]);
  const ctx = await editorContext(branchId, null, locale);
  if (!ctx) redirect("/zones");

  return (
    <div className="grid max-w-5xl gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("newZone")}</h1>
        <p className="text-sm text-muted-foreground">{localized(ctx.branch, "name", locale)}</p>
      </div>
      <ZoneForm
        id={null}
        center={ctx.center}
        pin={ctx.pin}
        otherZones={ctx.otherZones}
        initial={{
          branchId,
          nameEn: "",
          nameAr: "",
          fee: "0.500",
          minOrder: "0.000",
          etaMinutes: "45",
          color: ZONE_COLORS[ctx.zoneCount % ZONE_COLORS.length]!,
          isActive: true,
          polygons: [],
        }}
      />
    </div>
  );
}
