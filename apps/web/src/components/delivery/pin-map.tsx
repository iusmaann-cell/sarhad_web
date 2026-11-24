"use client";

import { DEFAULT_MAP_STYLE_URL, KUWAIT_CENTER, type LngLat, type ZoneArea } from "@sarhad/core";
import type { Locale } from "@sarhad/i18n";
import { createBaseMap, type MapLibre, type MapLibreMap } from "@sarhad/ui/map";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";

import "maplibre-gl/dist/maplibre-gl.css";

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;

/** A map where the customer places a draggable pin. Delivery areas are shown faded. */
export function PinMap({
  value,
  onChange,
  zones = [],
  onFallback,
  className = "h-[320px]",
}: {
  value: LngLat | null;
  onChange: (p: LngLat) => void;
  zones?: { color: string; area: ZoneArea }[];
  onFallback?: () => void;
  className?: string;
}) {
  const locale = useLocale() as Locale;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mlRef = useRef<MapLibre | null>(null);
  const markerRef = useRef<InstanceType<MapLibre["Marker"]> | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef({ onChange, value, zones, onFallback });
  useEffect(() => {
    latest.current = { onChange, value, zones, onFallback };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!container.current) return;
      const start = latest.current.value;
      const { ml, map } = await createBaseMap({
        container: container.current,
        styleUrl: STYLE_URL,
        center: start ?? [KUWAIT_CENTER.longitude, KUWAIT_CENTER.latitude],
        zoom: start ? 15 : 10.5,
        locale,
        onStyleFallback: () => latest.current.onFallback?.(),
      });
      if (cancelled) {
        map.remove();
        return;
      }
      mapRef.current = map;
      mlRef.current = ml;
      map.once("load", () => {
        map.addSource("zones", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: latest.current.zones.map((z) => ({
              type: "Feature",
              properties: { color: z.color },
              geometry: z.area,
            })),
          },
        });
        map.addLayer({
          id: "zones-fill",
          type: "fill",
          source: "zones",
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.12 },
        });
        map.on("click", (e) => latest.current.onChange([e.lngLat.lng, e.lngLat.lat]));
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker where the value says.
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!ready || !map || !ml || !value) return;
    if (!markerRef.current) {
      markerRef.current = new ml.Marker({ color: "#9f1d14", draggable: true })
        .setLngLat(value)
        .addTo(map);
      markerRef.current.on("dragend", () => {
        const ll = markerRef.current!.getLngLat();
        latest.current.onChange([ll.lng, ll.lat]);
      });
    } else {
      markerRef.current.setLngLat(value);
    }
    if (!map.getBounds().contains(value)) map.flyTo({ center: value, zoom: 15 });
  }, [value, ready]);

  return (
    <div
      ref={container}
      dir="ltr"
      data-testid="pin-map"
      data-ready={ready ? "true" : "false"}
      className={`w-full overflow-hidden rounded-lg border bg-muted ${className}`}
    />
  );
}
