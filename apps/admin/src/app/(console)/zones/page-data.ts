import "server-only";

import { KUWAIT_CENTER, type LngLat } from "@sarhad/core";
import type { Locale } from "@sarhad/i18n";

import { loadBranches, loadZones, toMapZone } from "./load";

/** Branch pin, map center and the branch's other zones for the editor. */
export async function editorContext(branchId: string, exceptZoneId: string | null, locale: Locale) {
  const [branches, zones] = await Promise.all([loadBranches(), loadZones(branchId)]);
  const branch = branches.find((b) => b.id === branchId);
  if (!branch) return null;
  const pin: LngLat | null =
    branch.latitude !== null && branch.longitude !== null
      ? [branch.longitude, branch.latitude]
      : null;
  return {
    branch,
    pin,
    center: pin ?? ([KUWAIT_CENTER.longitude, KUWAIT_CENTER.latitude] as LngLat),
    otherZones: zones.filter((z) => z.id !== exceptZoneId).map((z) => toMapZone(z, locale)),
    zoneCount: zones.length,
  };
}
