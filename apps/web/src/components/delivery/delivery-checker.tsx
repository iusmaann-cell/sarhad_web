"use client";

import {
  DEFAULT_MAP_STYLE_URL,
  formatPrice,
  KUWAIT_CENTER,
  type DeliveryMatch,
  type LngLat,
} from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Alert, Button, Card, CardContent } from "@sarhad/ui";
import { createBaseMap, type MapLibre, type MapLibreMap } from "@sarhad/ui/map";
import { Bike, Clock, LocateFixed, MapPin, ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { checkDelivery } from "@/app/[locale]/delivery/actions";
import { Link } from "@/i18n/navigation";
import type { PublicZone } from "@/lib/delivery";

import "maplibre-gl/dist/maplibre-gl.css";

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;
/** Remembered for checkout (Phase 4). Per browser only. */
const STORAGE_KEY = "sarhad.deliveryPoint";

type Result =
  { status: "idle" } | { status: "error" } | { status: "done"; match: DeliveryMatch | null };

function savePoint(p: LngLat) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lng: p[0], lat: p[1] }));
  } catch {
    // Private mode or storage blocked: nothing to remember.
  }
}

function loadPoint(): LngLat | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as {
      lng: number;
      lat: number;
    } | null;
    return v && Number.isFinite(v.lng) && Number.isFinite(v.lat) ? [v.lng, v.lat] : null;
  } catch {
    return null;
  }
}

export function DeliveryChecker({ zones }: { zones: PublicZone[] }) {
  const t = useTranslations("delivery");
  const locale = useLocale() as Locale;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mlRef = useRef<MapLibre | null>(null);
  const markerRef = useRef<InstanceType<MapLibre["Marker"]> | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [result, setResult] = useState<Result>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  const checkRef = useRef<(p: LngLat) => void>(() => {});
  useEffect(() => {
    checkRef.current = (p: LngLat) => {
      const map = mapRef.current;
      const ml = mlRef.current;
      if (map && ml) {
        if (!markerRef.current) {
          markerRef.current = new ml.Marker({ color: "#9f1d14", draggable: true })
            .setLngLat(p)
            .addTo(map);
          markerRef.current.on("dragend", () => {
            const ll = markerRef.current!.getLngLat();
            checkRef.current([ll.lng, ll.lat]);
          });
        } else {
          markerRef.current.setLngLat(p);
        }
      }
      savePoint(p);
      startTransition(async () => {
        const res = await checkDelivery({ lat: p[1], lng: p[0] });
        setResult(res.ok ? { status: "done", match: res.matches[0] ?? null } : { status: "error" });
      });
    };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!container.current) return;
      const { ml, map } = await createBaseMap({
        container: container.current,
        styleUrl: STYLE_URL,
        center: [KUWAIT_CENTER.longitude, KUWAIT_CENTER.latitude],
        zoom: 10.5,
        locale,
        onStyleFallback: () => setFallback(true),
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
            features: zones.map((z) => ({
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
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.15 },
        });
        map.addLayer({
          id: "zones-line",
          type: "line",
          source: "zones",
          paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-opacity": 0.7 },
        });
        map.on("click", (e) => checkRef.current([e.lngLat.lng, e.lngLat.lat]));
        const saved = loadPoint();
        if (saved) {
          map.jumpTo({ center: saved, zoom: 13 });
          checkRef.current(saved);
        }
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once per page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    setLocationError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p: LngLat = [pos.coords.longitude, pos.coords.latitude];
        mapRef.current?.flyTo({ center: p, zoom: 14 });
        checkRef.current(p);
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const match = result.status === "done" ? result.match : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={locateMe} disabled={!ready || locating}>
            <LocateFixed /> {locating ? t("locating") : t("useMyLocation")}
          </Button>
          <span className="text-sm text-muted-foreground">{t("pinHint")}</span>
        </div>
        <div
          ref={container}
          dir="ltr"
          data-testid="delivery-map"
          data-ready={ready ? "true" : "false"}
          className="h-[420px] w-full overflow-hidden rounded-xl border bg-muted lg:h-[520px]"
        />
        {locationError ? <p className="text-sm text-destructive">{t("locationDenied")}</p> : null}
        {fallback ? <p className="text-sm text-brand-amber">{t("mapFallback")}</p> : null}
      </div>

      <div aria-live="polite" data-testid="delivery-result">
        {pending ? (
          <Card>
            <CardContent className="pt-6 text-muted-foreground">{t("checking")}</CardContent>
          </Card>
        ) : result.status === "error" ? (
          <Alert variant="destructive">{t("error")}</Alert>
        ) : result.status === "done" && match ? (
          <Card className="border-success/50">
            <CardContent className="grid gap-4 pt-6">
              <div>
                <p className="text-lg font-bold text-success">
                  {t("yes", {
                    zone: locale === "ar" ? match.zone_name_ar : match.zone_name_en,
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("fromBranch", {
                    branch: localized(
                      { name_en: match.branch_name_en, name_ar: match.branch_name_ar },
                      "name",
                      locale,
                    ),
                  })}
                </p>
              </div>
              <dl className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Bike className="size-4" aria-hidden /> {t("fee")}
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {match.fee_fils === 0 ? t("free") : formatPrice(match.fee_fils, locale)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <ShoppingBag className="size-4" aria-hidden /> {t("minOrder")}
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatPrice(match.min_order_fils, locale)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4" aria-hidden /> {t("eta")}
                  </dt>
                  <dd className="font-semibold">{t("etaValue", { minutes: match.eta_minutes })}</dd>
                </div>
              </dl>
              <Button asChild>
                <Link href={{ pathname: "/menu", query: { branch: match.branch_slug } }}>
                  {t("browseMenu")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : result.status === "done" ? (
          <Card className="border-brand-amber/50">
            <CardContent className="grid gap-3 pt-6">
              <p className="text-lg font-bold">{t("no")}</p>
              <p className="text-sm text-muted-foreground">{t("noBody")}</p>
              <Button asChild variant="outline">
                <Link href="/branches">{t("seeBranches")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-start gap-3 pt-6 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              {t("intro")}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
