"use client";

import { toZoneArea, ZONE_COLORS, type LngLat, type ZoneAreaName } from "@sarhad/core";
import { Button, Card, CardContent, Checkbox, Field, Input, cn } from "@sarhad/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { FormAlert, useFieldError } from "@/components/form-alert";
import type { ActionResult } from "@/lib/action-result";

import { deleteZone, saveZone } from "./actions";
import { ZoneMap, type MapZone } from "./zone-map";

export type ZoneValues = {
  branchId: string;
  nameEn: string;
  nameAr: string;
  fee: string;
  minOrder: string;
  etaMinutes: string;
  color: string;
  isActive: boolean;
  polygons: LngLat[][][];
  areas: ZoneAreaName[];
};

const EMPTY_AREA: ZoneAreaName = { cityEn: "", cityAr: "", nameEn: "", nameAr: "" };

type Props = {
  id: string | null;
  initial: ZoneValues;
  /** The branch's other zones, shown faded for reference. */
  otherZones: MapZone[];
  center: LngLat;
  pin: LngLat | null;
};

export function ZoneForm({ id, initial, otherZones, center, pin }: Props) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const err = useFieldError(result);
  const back = `/zones?branch=${v.branchId}`;
  const set = (k: keyof ZoneValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const { polygons, ...rest } = v;
    startTransition(async () => {
      const res = await saveZone(id, { ...rest, area: toZoneArea(polygons) });
      setResult(res);
      if (res.ok) router.push(back);
    });
  }

  function remove() {
    if (!id || !confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      const res = await deleteZone(id);
      setResult(res);
      if (res.ok) router.push(back);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <FormAlert result={result} />
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <Field id="z-nameEn" label={t("nameEn")} error={err("nameEn")}>
            <Input id="z-nameEn" dir="ltr" value={v.nameEn} onChange={set("nameEn")} />
          </Field>
          <Field id="z-nameAr" label={t("nameAr")} error={err("nameAr")}>
            <Input id="z-nameAr" dir="rtl" value={v.nameAr} onChange={set("nameAr")} />
          </Field>
          <Field id="z-fee" label={t("zoneFee")} error={err("fee")}>
            <Input id="z-fee" inputMode="decimal" dir="ltr" value={v.fee} onChange={set("fee")} />
          </Field>
          <Field id="z-minOrder" label={t("zoneMinOrder")} error={err("minOrder")}>
            <Input
              id="z-minOrder"
              inputMode="decimal"
              dir="ltr"
              value={v.minOrder}
              onChange={set("minOrder")}
            />
          </Field>
          <Field id="z-eta" label={t("zoneEta")} error={err("etaMinutes")}>
            <Input
              id="z-eta"
              type="number"
              min={5}
              max={240}
              dir="ltr"
              value={v.etaMinutes}
              onChange={set("etaMinutes")}
            />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t("zoneColor")}</legend>
            <div className="flex flex-wrap gap-2">
              {ZONE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setV((p) => ({ ...p, color: c }))}
                  aria-label={c}
                  aria-pressed={v.color === c}
                  className={cn(
                    "size-8 rounded-full border-2",
                    v.color === c ? "border-foreground ring-2 ring-ring" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <Checkbox
              label={t("isActive")}
              checked={v.isActive}
              onChange={(e) => setV((p) => ({ ...p, isActive: e.target.checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <AreaList areas={v.areas} onChange={(areas) => setV((p) => ({ ...p, areas }))} err={err} />

      <Card>
        <CardContent className="grid gap-2 pt-6">
          <ZoneMap
            zones={otherZones}
            center={center}
            pin={pin}
            editable={{
              polygons: v.polygons,
              color: v.color,
              onChange: (polygons) => setV((p) => ({ ...p, polygons })),
            }}
          />
          {err("area") ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {err("area")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : tc("save")}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(back)}>
          {tc("back")}
        </Button>
        {id ? (
          <Button
            type="button"
            variant="destructive"
            className="ms-auto"
            onClick={remove}
            disabled={pending}
          >
            {tc("delete")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

type AreaListProps = {
  areas: ZoneAreaName[];
  onChange: (areas: ZoneAreaName[]) => void;
  err: (key: string) => string | undefined;
};

/** The named city and area lists customers choose from on the website. */
function AreaList({ areas, onChange, err }: AreaListProps) {
  const t = useTranslations("admin");
  const update = (i: number, k: keyof ZoneAreaName, value: string) =>
    onChange(areas.map((a, j) => (j === i ? { ...a, [k]: value } : a)));
  // Start a new row in the same city as the last one, since areas come in groups.
  const add = () => {
    const last = areas[areas.length - 1];
    onChange([
      ...areas,
      last ? { ...EMPTY_AREA, cityEn: last.cityEn, cityAr: last.cityAr } : EMPTY_AREA,
    ]);
  };
  const fields: { k: keyof ZoneAreaName; label: string; dir: "ltr" | "rtl" }[] = [
    { k: "cityEn", label: t("areaCityEn"), dir: "ltr" },
    { k: "cityAr", label: t("areaCityAr"), dir: "rtl" },
    { k: "nameEn", label: t("areaNameEn"), dir: "ltr" },
    { k: "nameAr", label: t("areaNameAr"), dir: "rtl" },
  ];

  return (
    <Card>
      <CardContent className="grid gap-4 pt-6">
        <div>
          <h2 className="text-lg font-semibold">{t("zoneAreasTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("zoneAreasHelp")}</p>
        </div>
        {areas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noAreas")}</p>
        ) : (
          <ol className="grid gap-3">
            {areas.map((a, i) => (
              <li
                key={i}
                className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
              >
                {fields.map((f) => (
                  <Field
                    key={f.k}
                    id={`area-${i}-${f.k}`}
                    label={f.label}
                    error={err(`areas.${i}.${f.k}`)}
                  >
                    <Input
                      id={`area-${i}-${f.k}`}
                      dir={f.dir}
                      value={a[f.k]}
                      onChange={(e) => update(i, f.k, e.target.value)}
                    />
                  </Field>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onChange(areas.filter((_, j) => j !== i))}
                  aria-label={t("removeArea", { n: i + 1 })}
                >
                  ✕
                </Button>
              </li>
            ))}
          </ol>
        )}
        {err("areas") ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {err("areas")}
          </p>
        ) : null}
        <div>
          <Button type="button" variant="outline" onClick={add}>
            + {t("addArea")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
