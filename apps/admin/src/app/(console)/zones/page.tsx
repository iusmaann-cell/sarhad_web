import { canManageBranch, formatPrice, KUWAIT_CENTER, type LngLat } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Alert, Badge, Button, Card, cn } from "@sarhad/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { requireStaff } from "@/lib/staff";

import { loadBranches, loadZones, toMapZone } from "./load";
import { ZonesOverview } from "./zones-overview";

export default async function ZonesPage({ searchParams }: PageProps<"/zones">) {
  const staff = await requireStaff();
  const [t, tc, locale, branches, sp] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    getLocale() as Promise<Locale>,
    loadBranches(),
    searchParams,
  ]);

  const branch = branches.find((b) => b.id === sp.branch) ?? branches[0];
  if (!branch) {
    return (
      <div className="grid gap-6">
        <h1 className="text-2xl font-bold">{t("deliveryZones")}</h1>
        <p className="text-muted-foreground">{t("noZones")}</p>
      </div>
    );
  }

  const zones = await loadZones(branch.id);
  const canEdit = canManageBranch(staff.roles, branch.id);
  const pin: LngLat | null =
    branch.latitude !== null && branch.longitude !== null
      ? [branch.longitude, branch.latitude]
      : null;
  const center: LngLat = pin ?? [KUWAIT_CENTER.longitude, KUWAIT_CENTER.latitude];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("deliveryZones")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("zonesIntro")}</p>
        </div>
        {canEdit ? (
          <Button asChild>
            <Link href={`/zones/new?branch=${branch.id}`}>
              <Plus /> {t("newZone")}
            </Link>
          </Button>
        ) : null}
      </div>

      {branches.length > 1 ? (
        <nav className="flex flex-wrap gap-2" aria-label={tc("selectBranch")}>
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/zones?branch=${b.id}`}
              aria-current={b.id === branch.id ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm",
                b.id === branch.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {localized(b, "name", locale)}
            </Link>
          ))}
        </nav>
      ) : null}

      {!branch.accepts_delivery ? <Alert>{t("branchNoDelivery")}</Alert> : null}

      <ZonesOverview
        key={branch.id}
        zones={zones.map((z) => toMapZone(z, locale))}
        center={center}
        pin={pin}
        canEdit={canEdit}
      />

      <Card className="overflow-x-auto">
        {zones.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("noZones")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="p-3 text-start font-medium">{t("zoneName")}</th>
                <th className="p-3 text-start font-medium">{t("zoneFee")}</th>
                <th className="p-3 text-start font-medium">{t("zoneMinOrder")}</th>
                <th className="p-3 text-start font-medium">{t("zoneEta")}</th>
                <th className="p-3 text-start font-medium">{t("branchStatus")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: z.color }}
                        aria-hidden
                      />
                      <span>
                        {localized(z, "name", locale)}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {t("areaCount", { count: z.delivery_areas?.length ?? 0 })}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="p-3">
                    {z.fee_fils === 0 ? t("free") : formatPrice(z.fee_fils, locale)}
                  </td>
                  <td className="p-3">{formatPrice(z.min_order_fils, locale)}</td>
                  <td className="p-3">{t("minutesShort", { minutes: z.eta_minutes })}</td>
                  <td className="p-3">
                    <Badge variant={z.is_active ? "success" : "muted"}>
                      {z.is_active ? tc("active") : tc("inactive")}
                    </Badge>
                  </td>
                  <td className="p-3 text-end">
                    {canEdit ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/zones/${z.id}`}>{tc("edit")}</Link>
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
