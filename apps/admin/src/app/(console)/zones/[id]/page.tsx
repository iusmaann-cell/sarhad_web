import { canManageBranch, filsToKwd, fromZoneArea } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { requireStaff } from "@/lib/staff";

import { loadZone, zoneAreaValues } from "../load";
import { editorContext } from "../page-data";
import { ZoneForm } from "../zone-form";

export default async function EditZonePage({ params }: PageProps<"/zones/[id]">) {
  const { id } = await params;
  const staff = await requireStaff();
  const zone = await loadZone(id);
  if (!zone) notFound();
  if (!canManageBranch(staff.roles, zone.branch_id)) redirect(`/zones?branch=${zone.branch_id}`);

  const [t, locale] = await Promise.all([getTranslations("admin"), getLocale() as Promise<Locale>]);
  const ctx = await editorContext(zone.branch_id, zone.id, locale);
  if (!ctx) notFound();

  return (
    <div className="grid max-w-5xl gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("editZone")}</h1>
        <p className="text-sm text-muted-foreground">{localized(ctx.branch, "name", locale)}</p>
      </div>
      <ZoneForm
        id={zone.id}
        center={ctx.center}
        pin={ctx.pin}
        otherZones={ctx.otherZones}
        initial={{
          branchId: zone.branch_id,
          nameEn: zone.name_en,
          nameAr: zone.name_ar,
          fee: filsToKwd(zone.fee_fils),
          minOrder: filsToKwd(zone.min_order_fils),
          etaMinutes: String(zone.eta_minutes),
          color: zone.color,
          isActive: zone.is_active,
          polygons: fromZoneArea(zone.area_geojson),
          areas: zoneAreaValues(zone),
        }}
      />
    </div>
  );
}
