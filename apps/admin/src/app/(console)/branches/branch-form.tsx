"use client";

import { slugify, WEEK_DAYS, type OpeningHours, type TimeRange, type WeekDay } from "@sarhad/core";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
} from "@sarhad/ui";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { FormAlert, useFieldError } from "@/components/form-alert";
import type { ActionResult } from "@/lib/action-result";

import { saveBranch } from "./actions";

export type BranchFormValues = {
  nameEn: string;
  nameAr: string;
  slug: string;
  addressEn: string;
  addressAr: string;
  phone: string;
  whatsapp: string;
  latitude: string;
  longitude: string;
  isActive: boolean;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  sortOrder: string;
  openingHours: OpeningHours;
};

export function BranchForm({ id, initial }: { id: string | null; initial: BranchFormValues }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const td = useTranslations("days");
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const err = useFieldError(result);

  const set = <K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const setDay = (day: WeekDay, ranges: TimeRange[]) =>
    setV((prev) => ({ ...prev, openingHours: { ...prev.openingHours, [day]: ranges } }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveBranch(id, v);
      setResult(res);
      if (res.ok && !id) router.push("/branches");
      else if (res.ok) router.refresh();
    });
  }

  const text = (
    key: keyof BranchFormValues,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <Field id={`b-${key}`} label={label} error={err(key)} hint={props.title}>
      <Input
        id={`b-${key}`}
        value={v[key] as string}
        onChange={(e) => set(key, e.target.value as never)}
        aria-invalid={!!err(key)}
        {...props}
        title={undefined}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <FormAlert result={result} />
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <Field id="b-nameEn" label={t("nameEn")} error={err("nameEn")}>
            <Input
              id="b-nameEn"
              dir="ltr"
              value={v.nameEn}
              onChange={(e) => {
                set("nameEn", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
            />
          </Field>
          {text("nameAr", t("nameAr"), { dir: "rtl" })}
          <Field id="b-slug" label={t("slug")} hint={t("slugHint")} error={err("slug")}>
            <Input
              id="b-slug"
              dir="ltr"
              value={v.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value);
              }}
            />
          </Field>
          {text("sortOrder", t("sortOrder"), { type: "number", min: 0, dir: "ltr" })}
          {text("addressEn", t("addressEn"), { dir: "ltr" })}
          {text("addressAr", t("addressAr"), { dir: "rtl" })}
          {text("phone", t("branchPhone"), { type: "tel", dir: "ltr" })}
          {text("whatsapp", t("whatsapp"), { type: "tel", dir: "ltr" })}
          {text("latitude", t("latitude"), {
            inputMode: "decimal",
            dir: "ltr",
            placeholder: "29.3759",
          })}
          {text("longitude", t("longitude"), {
            inputMode: "decimal",
            dir: "ltr",
            placeholder: "47.9774",
          })}
          <p className="text-xs text-muted-foreground md:col-span-2">{t("mapPinHint")}</p>
          <div className="flex flex-wrap gap-6 md:col-span-2">
            <Checkbox
              label={t("isActive")}
              checked={v.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            <Checkbox
              label={t("acceptsDelivery")}
              checked={v.acceptsDelivery}
              onChange={(e) => set("acceptsDelivery", e.target.checked)}
            />
            <Checkbox
              label={t("acceptsPickup")}
              checked={v.acceptsPickup}
              onChange={(e) => set("acceptsPickup", e.target.checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("openingHours")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {WEEK_DAYS.map((day) => {
            const ranges = v.openingHours[day] ?? [];
            return (
              <div
                key={day}
                className="grid gap-2 border-b pb-3 last:border-0 sm:grid-cols-[8rem_1fr] sm:items-start"
              >
                <span className="pt-2 text-sm font-medium">{td(day)}</span>
                <div className="grid gap-2">
                  {ranges.length === 0 ? (
                    <span className="pt-2 text-sm text-muted-foreground">{t("closedAllDay")}</span>
                  ) : null}
                  {ranges.map((r, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Input
                        type="time"
                        aria-label={`${td(day)} ${t("open")}`}
                        className="w-32"
                        dir="ltr"
                        value={r.open}
                        aria-invalid={!!err(`openingHours.${day}.${i}.open`)}
                        onChange={(e) =>
                          setDay(
                            day,
                            ranges.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)),
                          )
                        }
                      />
                      <span aria-hidden>–</span>
                      <Input
                        type="time"
                        aria-label={`${td(day)} ${t("close")}`}
                        className="w-32"
                        dir="ltr"
                        value={r.close}
                        aria-invalid={!!err(`openingHours.${day}.${i}.close`)}
                        onChange={(e) =>
                          setDay(
                            day,
                            ranges.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={tc("remove")}
                        onClick={() =>
                          setDay(
                            day,
                            ranges.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {ranges.length < 3 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDay(day, [...ranges, { open: "11:00", close: "23:00" }])}
                      >
                        <Plus /> {t("addHours")}
                      </Button>
                    ) : null}
                    {day === "sat" && ranges.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          set(
                            "openingHours",
                            Object.fromEntries(WEEK_DAYS.map((d) => [d, ranges])) as OpeningHours,
                          )
                        }
                      >
                        {t("copyToAll")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? tc("loading") : tc("save")}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/branches")}>
          {tc("back")}
        </Button>
      </div>
    </form>
  );
}

export const emptyBranch: BranchFormValues = {
  nameEn: "",
  nameAr: "",
  slug: "",
  addressEn: "",
  addressAr: "",
  phone: "",
  whatsapp: "",
  latitude: "",
  longitude: "",
  isActive: false,
  acceptsDelivery: true,
  acceptsPickup: true,
  sortOrder: "0",
  openingHours: {},
};
