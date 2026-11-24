"use client";

import { toZoneArea, ZONE_COLORS, type LngLat } from "@sarhad/core";
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
};

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
