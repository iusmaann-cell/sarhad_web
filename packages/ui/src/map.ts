// Shared MapLibre setup for the website and back office. Browser only: call
// createBaseMap() from an effect. Import from "@sarhad/ui/map".
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

export type MapLibre = typeof import("maplibre-gl");
export type { MapLibreMap };

/** Where the apps serve the worker (copied by scripts/copy-map-worker.mjs). */
export const MAP_WORKER_PATH = "/maplibre/maplibre-gl-worker.mjs";

/** Plain background used when the map style cannot be loaded (offline, blocked). */
export const BLANK_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#f1ede6" } }],
};

let workerSet = false;

/** Show place names in the visitor's language where the map has them. */
function localizeLabels(map: MapLibreMap, locale: "ar" | "en") {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== "symbol") continue;
    const field = map.getLayoutProperty(layer.id, "text-field");
    if (field && JSON.stringify(field).includes('"name')) {
      map.setLayoutProperty(layer.id, "text-field", [
        "coalesce",
        ["get", `name:${locale}`],
        ["get", "name"],
      ]);
    }
  }
}

export async function createBaseMap(opts: {
  container: HTMLElement;
  styleUrl: string;
  center: [number, number];
  zoom: number;
  locale: "ar" | "en";
  /** Called when the style failed and the blank background is shown instead. */
  onStyleFallback?: () => void;
}): Promise<{ ml: MapLibre; map: MapLibreMap }> {
  const ml = await import("maplibre-gl");
  if (!workerSet) {
    ml.setWorkerUrl(
      new URL(`${MAP_WORKER_PATH}?v=${ml.getVersion()}`, window.location.origin).href,
    );
    workerSet = true;
  }

  const map = new ml.Map({
    container: opts.container,
    style: opts.styleUrl,
    center: opts.center,
    zoom: opts.zoom,
    attributionControl: { compact: true },
    cooperativeGestures: false,
  });
  map.addControl(
    new ml.NavigationControl({ showCompass: false }),
    opts.locale === "ar" ? "top-left" : "top-right",
  );

  let fellBack = false;
  const fallBack = () => {
    if (fellBack || map.isStyleLoaded()) return;
    fellBack = true;
    map.setStyle(BLANK_MAP_STYLE);
    opts.onStyleFallback?.();
  };
  map.on("error", fallBack);
  const timer = window.setTimeout(fallBack, 10000);
  map.once("load", () => {
    window.clearTimeout(timer);
    if (!fellBack) localizeLabels(map, opts.locale);
  });

  return { ml, map };
}
