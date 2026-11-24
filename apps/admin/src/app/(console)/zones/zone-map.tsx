"use client";

import { DEFAULT_MAP_STYLE_URL, fromZoneArea, type LngLat, type ZoneArea } from "@sarhad/core";
import { Button } from "@sarhad/ui";
import { createBaseMap, type MapLibreMap } from "@sarhad/ui/map";
import { Eraser, MousePointer2, PenLine, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { TerraDraw } from "terra-draw";

import "maplibre-gl/dist/maplibre-gl.css";

export type MapZone = { id: string; name: string; color: string; area: ZoneArea };

type Editable = {
  polygons: LngLat[][][];
  color: string;
  onChange: (polygons: LngLat[][][]) => void;
};

type Props = {
  /** Zones drawn as coloured shapes (faded when editing another zone). */
  zones: MapZone[];
  /** Branch pin, also the starting center. */
  center: LngLat;
  pin?: LngLat | null;
  editable?: Editable;
  onZoneClick?: (id: string) => void;
  className?: string;
};

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;

function zonesGeoJson(zones: MapZone[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((z) => ({
      type: "Feature",
      id: z.id,
      properties: { id: z.id, name: z.name, color: z.color },
      geometry: z.area,
    })),
  };
}

function extend(bounds: [number, number, number, number] | null, p: LngLat) {
  if (!bounds) return [p[0], p[1], p[0], p[1]] as [number, number, number, number];
  return [
    Math.min(bounds[0], p[0]),
    Math.min(bounds[1], p[1]),
    Math.max(bounds[2], p[0]),
    Math.max(bounds[3], p[1]),
  ] as [number, number, number, number];
}

type Mode = "polygon" | "select";

export function ZoneMap({ zones, center, pin, editable, onZoneClick, className }: Props) {
  const t = useTranslations("admin");
  const locale = useLocale() as "ar" | "en";
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("select");
  const [selected, setSelected] = useState<string | null>(null);

  // Keep the latest props for map callbacks without re-creating the map.
  const latest = useRef({ zones, editable, onZoneClick });
  useEffect(() => {
    latest.current = { zones, editable, onZoneClick };
  });

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;

    (async () => {
      if (!container.current) return;
      const base = await createBaseMap({
        container: container.current,
        styleUrl: STYLE_URL,
        center,
        zoom: 11,
        locale,
        onStyleFallback: () => setFallback(true),
      });
      map = base.map;
      if (cancelled) {
        map.remove();
        return;
      }
      mapRef.current = map;
      const { ml } = base;

      map.once("load", async () => {
        if (cancelled || !map) return;
        const { zones: initialZones, editable: edit } = latest.current;

        map.addSource("zones", { type: "geojson", data: zonesGeoJson(initialZones) });
        map.addLayer({
          id: "zones-fill",
          type: "fill",
          source: "zones",
          paint: { "fill-color": ["get", "color"], "fill-opacity": edit ? 0.12 : 0.3 },
        });
        map.addLayer({
          id: "zones-line",
          type: "line",
          source: "zones",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 2,
            "line-opacity": edit ? 0.5 : 1,
            ...(edit ? { "line-dasharray": [2, 2] } : {}),
          },
        });

        if (!edit) {
          map.on("click", "zones-fill", (e) => {
            const id = e.features?.[0]?.properties?.id as string | undefined;
            if (id) latest.current.onZoneClick?.(id);
          });
          map.on("mouseenter", "zones-fill", () => (map!.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", "zones-fill", () => (map!.getCanvas().style.cursor = ""));
        }

        if (pin) new ml.Marker({ color: "#7c2d12" }).setLngLat(pin).addTo(map);

        // Fit the view to what is on the map.
        let bounds: [number, number, number, number] | null = null;
        const shapes = [
          ...initialZones.flatMap((z) => fromZoneArea(z.area)),
          ...(edit?.polygons ?? []),
        ];
        for (const poly of shapes) for (const p of poly[0] ?? []) bounds = extend(bounds, p);
        if (bounds) map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 14 });

        if (edit) {
          const td = await import("terra-draw");
          const { TerraDrawMapLibreGLAdapter } = await import("terra-draw-maplibre-gl-adapter");
          if (cancelled) return;
          const color = edit.color as `#${string}`;
          const draw = new td.TerraDraw({
            adapter: new TerraDrawMapLibreGLAdapter({ map }),
            modes: [
              new td.TerraDrawPolygonMode({
                styles: {
                  fillColor: color,
                  fillOpacity: 0.35,
                  outlineColor: color,
                  outlineWidth: 2,
                },
                validation: (feature) => td.ValidateNotSelfIntersecting(feature),
              }),
              new td.TerraDrawSelectMode({
                flags: {
                  polygon: {
                    feature: {
                      draggable: true,
                      coordinates: { draggable: true, deletable: true, midpoints: true },
                    },
                  },
                },
                styles: {
                  selectedPolygonColor: color,
                  selectedPolygonOutlineColor: color,
                  selectedPolygonFillOpacity: 0.45,
                },
              }),
            ],
          });
          draw.start();
          draw.addFeatures(
            edit.polygons.map((coordinates) => ({
              type: "Feature" as const,
              id: crypto.randomUUID(),
              geometry: { type: "Polygon" as const, coordinates },
              properties: { mode: "polygon" },
            })),
          );
          const emit = () => {
            const polys = draw
              .getSnapshot()
              .filter((f) => f.geometry.type === "Polygon" && !f.properties.currentlyDrawing)
              .map((f) => f.geometry.coordinates as LngLat[][]);
            latest.current.editable?.onChange(polys);
          };
          draw.on("finish", () => {
            emit();
            // After closing a shape, switch to editing so a stray click does not start another.
            draw.setMode("select");
            setMode("select");
          });
          draw.on("change", (_ids, type) => {
            if (type !== "styling") emit();
          });
          draw.on("select", (id) => setSelected(String(id)));
          draw.on("deselect", () => setSelected(null));
          const startMode: Mode = edit.polygons.length === 0 ? "polygon" : "select";
          draw.setMode(startMode);
          setMode(startMode);
          drawRef.current = draw;
        }
        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      drawRef.current?.stop();
      drawRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background zones changed (e.g. after saving).
  useEffect(() => {
    const src = mapRef.current?.getSource("zones");
    if (ready && src && "setData" in src) {
      (src as { setData: (d: GeoJSON.FeatureCollection) => void }).setData(zonesGeoJson(zones));
    }
  }, [zones, ready]);

  // Colour picked in the form.
  const color = editable?.color;
  useEffect(() => {
    const draw = drawRef.current;
    if (!ready || !draw || !color) return;
    const c = color as `#${string}`;
    draw.updateModeOptions<typeof import("terra-draw").TerraDrawPolygonMode>("polygon", {
      styles: { fillColor: c, outlineColor: c, fillOpacity: 0.35, outlineWidth: 2 },
    });
    draw.updateModeOptions<typeof import("terra-draw").TerraDrawSelectMode>("select", {
      styles: { selectedPolygonColor: c, selectedPolygonOutlineColor: c },
    });
  }, [color, ready]);

  function switchMode(next: Mode) {
    drawRef.current?.setMode(next);
    setMode(next);
  }

  function deleteSelected() {
    const draw = drawRef.current;
    if (!draw || !selected) return;
    draw.deselectFeature(selected);
    draw.removeFeatures([selected]);
    setSelected(null);
  }

  function clearAll() {
    const draw = drawRef.current;
    if (!draw) return;
    draw.clear();
    editable?.onChange([]);
    switchMode("polygon");
  }

  return (
    <div className={className}>
      {editable ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "polygon" ? "default" : "outline"}
            onClick={() => switchMode("polygon")}
            disabled={!ready}
            aria-pressed={mode === "polygon"}
          >
            <PenLine /> {t("mapDraw")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "select" ? "default" : "outline"}
            onClick={() => switchMode("select")}
            disabled={!ready}
            aria-pressed={mode === "select"}
          >
            <MousePointer2 /> {t("mapEdit")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={deleteSelected}
            disabled={!ready || !selected}
          >
            <Trash2 /> {t("mapDeleteSelected")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearAll}
            disabled={!ready || editable.polygons.length === 0}
          >
            <Eraser /> {t("mapClear")}
          </Button>
          <span className="ms-auto text-sm text-muted-foreground" aria-live="polite">
            {t("mapShapes", { count: editable.polygons.length })}
          </span>
        </div>
      ) : null}
      {/* Map canvases are left-to-right even in Arabic; controls are placed per locale. */}
      <div
        ref={container}
        dir="ltr"
        data-testid="zone-map"
        data-ready={ready ? "true" : "false"}
        className="h-[420px] w-full overflow-hidden rounded-lg border bg-muted"
      />
      {editable ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "polygon" ? t("mapHintDraw") : t("mapHintEdit")}
          {zones.length > 0 ? ` ${t("otherZones")}` : ""}
        </p>
      ) : null}
      {fallback ? <p className="mt-1 text-sm text-amber-700">{t("mapFallback")}</p> : null}
    </div>
  );
}
