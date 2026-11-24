"use client";

import type { LngLat } from "@sarhad/core";
import { useRouter } from "next/navigation";

import { ZoneMap, type MapZone } from "./zone-map";

export function ZonesOverview(props: {
  zones: MapZone[];
  center: LngLat;
  pin: LngLat | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  return (
    <ZoneMap
      zones={props.zones}
      center={props.center}
      pin={props.pin}
      onZoneClick={props.canEdit ? (id) => router.push(`/zones/${id}`) : undefined}
    />
  );
}
